import { Composio } from '@composio/core';
import { GoogleProvider } from '@composio/google';
import {
  COMPOSIO_GOOGLE_TOOLS,
  type ComposioFileMetadata,
  type ComposioShareResult,
  mapComposioError,
  mapComposioDriveError,
} from './composio-tools-mapping';
import { extractPlaceholderDefinitionsFromText, type TemplatePlaceholderDefinition } from './google-docs';
import type { ConnectionStatus } from './composio-types';
import { debugLog, debugError, generateRequestId } from './utils/request-id';

// Re-export ConnectionStatus for consumers of composio-client
export type { ConnectionStatus } from './composio-types';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export class ConnectionCheckError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ConnectionCheckError';
  }
}

export interface ComposioClientConfig {
  apiKey?: string;
  /** Composio authConfigId for Google integration (from Composio dashboard) */
  googleAuthConfigId?: string;
  /** Callback URL for OAuth flow */
  callbackUrl?: string;
}

export interface ComposioClient {
  // Docs operations
  getDocumentContent(documentId: string): Promise<string>;
  getDocumentPlaceholders(documentId: string): Promise<TemplatePlaceholderDefinition[]>;
  batchUpdateDocument(documentId: string, requests: any[]): Promise<void>;

  // Drive operations
  getFileMetadata(fileId: string): Promise<ComposioFileMetadata>;
  copyFile(fileId: string, newName: string): Promise<string>;
  shareFile(fileId: string, email: string, role: 'writer' | 'commenter' | 'reader'): Promise<ComposioShareResult>;

  // Connection management
  getConnectionStatus(userId: string): Promise<ConnectionStatus>;
  initiateConnection(userId: string, returnTo?: string): Promise<string>; // returns redirect URL
  checkConnection(userId: string): Promise<{ connected: boolean; status: ConnectionStatus }>;
  clearConnectedAccountIdCache(userId: string): void;
}

// ============================================================
// COMPOSIO CLIENT IMPLEMENTATION
// ============================================================

const globalForComposio = globalThis as typeof globalThis & {
  __composioInstance?: Composio<any>;
};

// Module-level cache for connected account IDs, shared across all client instances
// Key: userId, Value: { id, expiresAt }
const connectedAccountIdCache = new Map<string, { id: string | undefined; expiresAt: number }>();

function clearConnectedAccountIdCache(userId: string): void {
  connectedAccountIdCache.delete(userId);
}

function getComposioInstance(apiKey?: string): Composio<any> {
  if (!globalForComposio.__composioInstance) {
    globalForComposio.__composioInstance = new Composio({
      apiKey: apiKey || process.env.COMPOSIO_API_KEY,
      provider: new GoogleProvider(),
    });
  }
  return globalForComposio.__composioInstance;
}

/**
 * Executes a Composio tool and returns the result.
 * Uses composio.tools.execute() — the correct v0.6.x API for direct tool execution.
 */
async function executeTool(
  composio: Composio,
  toolSlug: string,
  params: Record<string, unknown>,
  userId: string,
  connectedAccountId?: string,
  requestId?: string
): Promise<unknown> {
  const reqId = requestId || generateRequestId();
  try {
    debugLog(reqId, 'ComposioTool', 'Executing tool', { toolSlug, userId, connectedAccountId, params: Object.keys(params) });
    const result = await composio.tools.execute(toolSlug, {
      connectedAccountId,
      arguments: params,
      userId,
      version: 'latest',
    });
    debugLog(reqId, 'ComposioTool', 'Tool executed successfully', { toolSlug });
    return result;
  } catch (error) {
    debugError(reqId, 'ComposioTool', `Tool execution failed: ${toolSlug}`, error, { userId, connectedAccountId });
    throw mapComposioError(error, toolSlug);
  }
}

/**
 * Creates a Composio client for Google Docs/Drive operations
 * Returns an adapter that mirrors google-docs.ts and google-drive.ts signatures
 *
 * Composio SDK v0.6.x API:
 * - composio.connectedAccounts.initiate(userId, authConfigId, options) → starts OAuth
 * - composio.connectedAccounts.list({ userIds: [userId] }) → lists connected accounts
 * - composio.tools.execute(slug, body, modifiers) → executes a tool
 */
export async function createComposioClient(
  userId: string,
  config: ComposioClientConfig = {}
): Promise<ComposioClient> {
  const composio = getComposioInstance(config.apiKey);
  const requestId = generateRequestId();

  debugLog(requestId, 'ComposioClient', 'Client created', { userId, hasApiKey: !!config.apiKey, hasAuthConfigId: !!config.googleAuthConfigId });

  // Helper to get connected account for this user
  async function getConnectedAccountId(): Promise<string | undefined> {
    const cached = connectedAccountIdCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.id;
    }

    const authConfigId = config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;

    // Prefer authConfigId-based lookup (most precise)
    if (authConfigId) {
      try {
        const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
        const matched = accounts?.items?.find(
          (a: { authConfig?: { id?: string }; id?: string }) =>
            a.authConfig?.id === authConfigId
        );
        if (matched?.id) {
          console.info('[Composio] getConnectedAccountId: found account via authConfigId:', matched.id);
          connectedAccountIdCache.set(userId, { id: matched.id, expiresAt: Date.now() + 300000 });
          return matched.id;
        }
        console.warn('[Composio] getConnectedAccountId: authConfigId provided but no match found.', {
          authConfigId,
          availableAccounts: accounts?.items?.map((a: { id?: string; authConfig?: { id?: string }; toolkit?: { slug?: string } }) => ({
            id: a.id,
            authConfigId: a.authConfig?.id,
            toolkitSlug: a.toolkit?.slug,
          })),
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Composio] getConnectedAccountId error during authConfigId lookup:', error);
        throw new ConnectionCheckError(
          `Falha ao verificar conexão com Google via Composio: ${errMsg}`,
          error
        );
      }
    }

    // Fallback: filter by toolkit slug/name match for Google
    try {
      const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
      const googleAccounts = accounts?.items?.filter(
        (a: { toolkit?: { slug?: string; name?: string } }) =>
          a.toolkit?.slug?.toLowerCase() === 'google' ||
          a.toolkit?.slug?.toLowerCase() === 'googleworkspace' ||
          a.toolkit?.name?.toLowerCase() === 'google' ||
          a.toolkit?.name?.toLowerCase() === 'google workspace'
      );
      if (googleAccounts && googleAccounts.length > 0) {
        console.info('[Composio] getConnectedAccountId: found account via toolkit fallback:', googleAccounts[0].id);
        connectedAccountIdCache.set(userId, { id: googleAccounts[0].id, expiresAt: Date.now() + 300000 });
        return googleAccounts[0].id;
      }
      console.warn('[Composio] getConnectedAccountId: no Google accounts found.', {
        userId,
        availableAccounts: accounts?.items?.map((a: { id?: string; toolkit?: { slug?: string; name?: string } }) => ({
          id: a.id,
          slug: a.toolkit?.slug,
          name: a.toolkit?.name,
        })),
      });
      connectedAccountIdCache.set(userId, { id: undefined, expiresAt: Date.now() + 30000 });
      return undefined;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[Composio] getConnectedAccountId error during fallback lookup:', error);
      throw new ConnectionCheckError(
        `Falha ao verificar conexão com Google via Composio: ${errMsg}`,
        error
      );
    }
  }

  /** Standalone helper to check connection status, used by both getConnectionStatus and checkConnection */
  async function getConnectionStatusHelper(userId: string): Promise<ConnectionStatus> {
    try {
      const accountId = await getConnectedAccountId();
      if (!accountId) {
        debugLog(requestId, 'ComposioClient', 'getConnectionStatus: no connected account found', { userId });
        return 'INACTIVE';
      }

      const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
      const items = accounts?.items ?? accounts;
      const googleAccount = items?.find((a: { id?: string }) => a.id === accountId);

      if (!googleAccount) {
        console.warn('[Composio] getConnectionStatus: cached accountId not found in fresh list', { userId, accountId });
        return 'FAILED';
      }

      const status = googleAccount.status;
      debugLog(requestId, 'ComposioClient', 'getConnectionStatus', { userId, accountId, status });
      if (status === 'ACTIVE') return 'ACTIVE';
      if (status === 'INITIALIZING') return 'INITIALIZING';
      if (status === 'INITIATED') return 'INITIATED';
      if (status === 'EXPIRED') return 'EXPIRED';
      if (status === 'INACTIVE') return 'INACTIVE';
      return 'FAILED';
    } catch (error) {
      debugError(requestId, 'ComposioClient', 'getConnectionStatus error', error, { userId });
      console.error('[Composio] getConnectionStatus error:', error, { userId });
      return 'FAILED';
    }
  }

  return {
    // ------------------------------------------------
    // Docs operations
    // ------------------------------------------------

    async getDocumentContent(documentId: string): Promise<string> {
      try {
        debugLog(requestId, 'ComposioClient', 'getDocumentContent', { documentId, userId });
        const connectedAccountId = await getConnectedAccountId();
        if (!connectedAccountId) {
          debugError(requestId, 'ComposioClient', 'No connected account for getDocumentContent', new Error('No connected account'), { documentId, userId });
          throw new Error('Nenhuma conta Google conectada. Conecte sua conta nas configurações.');
        }
        const result = await executeWithRetry(
          () => executeTool(
            composio,
            COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT,
            { document_id: documentId },
            userId,
            connectedAccountId,
            requestId
          ),
          `getDocumentContent(${documentId})`,
          requestId
        );
        // GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT returns plain text directly
        const text = typeof result === 'string' ? result : (result as any)?.data ?? result;
        const content = typeof text === 'string' ? text : JSON.stringify(text);
        debugLog(requestId, 'ComposioClient', 'getDocumentContent success', { documentId, contentLength: content.length });
        return content;
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'getDocumentContent failed', error, { documentId, userId });
        mapGoogleDocsErrorToComposio(error, documentId);
      }
    },

    async getDocumentPlaceholders(documentId: string): Promise<TemplatePlaceholderDefinition[]> {
      // GAP: No Composio tool for placeholder extraction
      // Use local implementation (same as google-docs.ts)
      debugLog(requestId, 'ComposioClient', 'getDocumentPlaceholders', { documentId, userId });
      const self = this as ComposioClient;
      const content = await self.getDocumentContent(documentId);
      const placeholders = extractPlaceholderDefinitionsFromText(content);
      debugLog(requestId, 'ComposioClient', 'getDocumentPlaceholders result', { documentId, placeholderCount: placeholders.length });
      return placeholders;
    },

    async batchUpdateDocument(documentId: string, requests: any[]): Promise<void> {
      try {
        debugLog(requestId, 'ComposioClient', 'batchUpdateDocument', { documentId, requestCount: requests.length, userId });
        const connectedAccountId = await getConnectedAccountId();
        if (!connectedAccountId) {
          debugError(requestId, 'ComposioClient', 'No connected account for batchUpdateDocument', new Error('No connected account'), { documentId, userId });
          throw new Error('Nenhuma conta Google conectada. Conecte sua conta nas configurações.');
        }
        // Convert native Google Docs API requests to Composio format
        // Handles both containsText and containingText input formats
        const composioRequests = convertBatchRequestsToComposio(requests);

        if (composioRequests.length > 0) {
          await executeWithRetry(
            () => executeTool(
              composio,
              COMPOSIO_GOOGLE_TOOLS.DOCS_UPDATE_DOCUMENT,
              {
                document_id: documentId,
                requests: composioRequests
              },
              userId,
              connectedAccountId,
              requestId
            ),
            `batchUpdateDocument(${documentId})`,
            requestId
          );
        }
        debugLog(requestId, 'ComposioClient', 'batchUpdateDocument success', { documentId, appliedCount: composioRequests.length });
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'batchUpdateDocument failed', error, { documentId, requestCount: requests.length, userId });
        mapGoogleDocsErrorToComposio(error, documentId);
      }
    },

    // ------------------------------------------------
    // Drive operations
    // ------------------------------------------------

    async getFileMetadata(fileId: string): Promise<ComposioFileMetadata> {
      try {
        debugLog(requestId, 'ComposioClient', 'getFileMetadata', { fileId, userId });
        const connectedAccountId = await getConnectedAccountId();
        if (!connectedAccountId) {
          debugError(requestId, 'ComposioClient', 'No connected account for getFileMetadata', new Error('No connected account'), { fileId, userId });
          throw new Error('Nenhuma conta Google conectada.');
        }
        const result = await executeWithRetry(
          () => executeTool(
            composio,
            COMPOSIO_GOOGLE_TOOLS.DRIVE_GET_FILE,
            { file_id: fileId },
            userId,
            connectedAccountId,
            requestId
          ),
          `getFileMetadata(${fileId})`,
          requestId
        );
        // GOOGLEDRIVE_GET_FILE_V2 returns data directly or in data field
        const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>);
        const metadata = {
          id: (data.id as string) || fileId,
          name: (data.name as string) || (data.title as string) || 'unknown',
          mimeType: (data.mimeType as string) || (data.mime_type as string) || 'application/vnd.google-apps.document',
        };
        debugLog(requestId, 'ComposioClient', 'getFileMetadata success', { fileId, name: metadata.name, mimeType: metadata.mimeType });
        return metadata;
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'getFileMetadata failed', error, { fileId, userId });
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async copyFile(fileId: string, newName: string): Promise<string> {
      try {
        debugLog(requestId, 'ComposioClient', 'copyFile', { fileId, newName, userId });
        const connectedAccountId = await getConnectedAccountId();
        if (!connectedAccountId) {
          debugError(requestId, 'ComposioClient', 'No connected account for copyFile', new Error('No connected account'), { fileId, userId });
          throw new Error('Nenhuma conta Google conectada.');
        }
        const result = await executeWithRetry(
          () => executeTool(
            composio,
            COMPOSIO_GOOGLE_TOOLS.DRIVE_COPY_FILE,
            {
              file_id: fileId,
              name: newName,
              // GOOGLEDRIVE_COPY_FILE_ADVANCED may support additional options
              copy_title: newName,
            },
            userId,
            connectedAccountId,
            requestId
          ),
          `copyFile(${fileId}, ${newName})`,
          requestId
        );
        const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>);
        const newFileId = (data.id as string) || (data.fileId as string) || (data.documentId as string) || fileId;
        debugLog(requestId, 'ComposioClient', 'copyFile success', { fileId, newFileId, newName });
        return newFileId;
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'copyFile failed', error, { fileId, newName, userId });
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async shareFile(
      fileId: string,
      email: string,
      role: 'writer' | 'commenter' | 'reader' = 'writer'
    ): Promise<ComposioShareResult> {
      try {
        debugLog(requestId, 'ComposioClient', 'shareFile', { fileId, email, role, userId });
        const connectedAccountId = await getConnectedAccountId();
        if (!connectedAccountId) {
          debugError(requestId, 'ComposioClient', 'No connected account for shareFile', new Error('No connected account'), { fileId, userId });
          throw new Error('Nenhuma conta Google conectada.');
        }
        const result = await executeWithRetry(
          () => executeTool(
            composio,
            COMPOSIO_GOOGLE_TOOLS.DRIVE_CREATE_PERMISSION,
            {
              file_id: fileId,
              email,
              role,
              // GOOGLEDRIVE_CREATE_PERMISSION may expect specific parameter names
              permission: {
                type: 'user',
                role,
                emailAddress: email,
              }
            },
            userId,
            connectedAccountId,
            requestId
          ),
          `shareFile(${fileId}, ${email})`,
          requestId
        );
        const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>);
        const shareResult = {
          fileId,
          permissionId: (data.permissionId as string) || (data.id as string) || 'unknown',
        };
        debugLog(requestId, 'ComposioClient', 'shareFile success', { fileId, permissionId: shareResult.permissionId });
        return shareResult;
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'shareFile failed', error, { fileId, email, role, userId });
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    // ------------------------------------------------
    // Connection management
    // ------------------------------------------------

    async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
      return getConnectionStatusHelper(userId);
    },

    async initiateConnection(userId: string, returnTo?: string): Promise<string> {
      const authConfigId = config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
      if (!authConfigId) {
        const errMsg = 'COMPOSIO_GOOGLE_AUTH_CONFIG_ID not set. ' +
          'Create a Composio integration at https://app.composio.dev and set this env var.';
        debugError(requestId, 'ComposioClient', 'initiateConnection: missing authConfigId', new Error(errMsg), { userId });
        throw new Error(errMsg);
      }
      const callbackUrl = new URL(
        config.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/composio/callback`
      );
      if (returnTo && returnTo.startsWith('/')) {
        callbackUrl.searchParams.set('return_to', returnTo);
      }

      if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))) {
        console.warn('[Composio] NEXT_PUBLIC_APP_URL is not set or points to localhost. OAuth callbacks will fail in production.');
      }

      try {
        debugLog(requestId, 'ComposioClient', 'initiateConnection', { userId, returnTo, authConfigId });
        const connectionRequest = await composio.connectedAccounts.initiate(
          userId,
          authConfigId,
          { callbackUrl: callbackUrl.toString(), allowMultiple: true }
        );
        const redirectUrl = connectionRequest?.redirectUrl;
        if (!redirectUrl) {
          throw new Error('Composio did not return a redirect URL for OAuth.');
        }
        debugLog(requestId, 'ComposioClient', 'initiateConnection success', { redirectUrl });
        return redirectUrl;
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'initiateConnection failed', error, { userId, returnTo });
        const sdkMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Falha ao iniciar conexão com Google: ${sdkMessage}`);
      }
    },

    async checkConnection(userId: string): Promise<{ connected: boolean; status: ConnectionStatus }> {
      debugLog(requestId, 'ComposioClient', 'checkConnection', { userId });
      const status = await getConnectionStatusHelper(userId);
      const result = {
        connected: status === 'ACTIVE',
        status,
      };
      debugLog(requestId, 'ComposioClient', 'checkConnection result', result);
      return result;
    },

    clearConnectedAccountIdCache(userId: string): void {
      debugLog(requestId, 'ComposioClient', 'clearConnectedAccountIdCache', { userId });
      clearConnectedAccountIdCache(userId);
    },
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function extractTextFromDocument(docData: unknown): string {
  if (!docData) return '';
  if (typeof docData === 'string') return docData;
  const doc = docData as { body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> } };
  if (doc.body?.content) {
    let text = '';
    doc.body.content.forEach((element) => {
      if (element.paragraph?.elements) {
        element.paragraph.elements.forEach((el) => {
          if (el.textRun?.content) {
            text += el.textRun.content;
          }
        });
      }
    });
    return text;
  }
  const docAny = docData as Record<string, unknown>;
  return (docAny.text as string) || (docAny.content as string) || (docAny.body as string) || JSON.stringify(docData);
}

function convertBatchRequestsToComposio(requests: any[]): any[] {
  const composioRequests: any[] = [];
  let droppedCount = 0;

  for (const req of requests) {
    if (req.replaceAllText) {
      const containsText = req.replaceAllText.containsText || req.replaceAllText.containingText;
      const replaceText = req.replaceAllText.replaceText;
      const targetText =
        typeof containsText === 'string'
          ? containsText
          : containsText?.text || containsText?.content;

      if (!targetText) continue;

      composioRequests.push({
        replace_all_text: {
          replace_text: typeof replaceText === 'string' ? replaceText : replaceText?.text,
          target_text: targetText,
        },
      });
    } else if (req.insertText) {
      composioRequests.push({
        insert_text: {
          text: req.insertText.text,
          location: req.insertText.location,
        },
      });
    } else {
      // Pass through unknown request types — Composio may support them,
      // and if not, it's better to let it fail explicitly than drop silently
      composioRequests.push(req);
      droppedCount++;
    }
  }

  if (droppedCount > 0) {
    console.warn(`[Composio] convertBatchRequestsToComposio: ${droppedCount} request(s) have no explicit mapping and will be passed through as-is.`);
  }

  return composioRequests;
}

// ============================================================
// RETRY LOGIC FOR RATE LIMITS
// ============================================================

/**
 * Executes a function with retry logic for rate limit errors (HTTP 429).
 * Uses exponential backoff: 100ms, 200ms, 400ms between retries.
 * Max 3 retries total.
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
  requestId?: string
): Promise<T> {
  const reqId = requestId || generateRequestId();
  const maxRetries = 3;
  const backoffMs = [100, 200, 400];

  debugLog(reqId, 'ComposioRetry', `Starting retry loop`, { context, maxRetries });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit =
        (error instanceof Error && error.message?.includes('429')) ||
        (error as any)?.status === 429 ||
        (error as any)?.code === 'rateLimitExceeded' ||
        JSON.stringify(error).includes('rateLimitExceeded');

      if (isRateLimit && attempt < maxRetries) {
        const delay = backoffMs[attempt] || backoffMs[backoffMs.length - 1];
        debugLog(reqId, 'ComposioRetry', `Rate limit hit on ${context}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      debugError(reqId, 'ComposioRetry', `Max retries exceeded or non-rate-limit error for ${context}`, error);
      throw error;
    }
  }

  throw new Error(`[Composio] Max retries exceeded for ${context}`);
}

// ============================================================
// RETRY WITH AUTH REFRESH FOR 401 ERRORS
// ============================================================

/**
 * Executes a function with retry logic that also handles auth errors (401/expired tokens).
 * If a rate limit error occurs, retries with exponential backoff.
 * If an auth error occurs (401), clears the connection cache once and retries.
 * @param fn - The function to execute
 * @param context - Description for logging
 * @param userId - User ID for cache invalidation
 * @param requestId - Request ID for logging
 * @param retries - Number of retries remaining
 */
async function executeWithRetryAndAuthRefresh<T>(
  fn: () => Promise<T>,
  context: string,
  userId: string,
  requestId: string,
  retries = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const isAuthError =
      (error instanceof Error && (error.message?.includes('401') || error.message?.includes('AUTH_EXPIRED') || error.message?.includes('unauthorized'))) ||
      (error as any)?.status === 401 ||
      (error as any)?.code === 'AUTH_EXPIRED';

    if (isAuthError && retries > 0) {
      debugLog(requestId, 'ComposioAuthRetry', `Auth error detected, clearing cache and retrying (${retries} attempts left)`, {
        context,
        userId,
      });

      // Invalidate connection cache to force fresh auth check
      const client = await createComposioClient(userId);
      client.clearConnectedAccountIdCache(userId);

      // Small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 100));

      return executeWithRetryAndAuthRefresh(fn, context, userId, requestId, retries - 1);
    }

    // Check for rate limit
    const isRateLimit =
      (error instanceof Error && error.message?.includes('429')) ||
      (error as any)?.status === 429 ||
      (error as any)?.code === 'rateLimitExceeded';

    if (isRateLimit && retries > 0) {
      const delay = 200 * (3 - retries); // 200ms, 400ms, 800ms
      debugLog(requestId, 'ComposioAuthRetry', `Rate limit hit, retrying in ${delay}ms`, { context });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeWithRetryAndAuthRefresh(fn, context, userId, requestId, retries - 1);
    }

    throw error;
  }
}

// ============================================================
// ERROR MAPPING (ported from google-docs.ts / google-drive.ts)
// ============================================================

function mapGoogleDocsErrorToComposio(composioError: unknown, documentId: string): never {
  throw mapComposioError(composioError, documentId);
}

function mapGoogleDriveErrorToComposio(composioError: unknown, fileId: string): never {
  throw mapComposioDriveError(composioError, fileId);
}

// ============================================================
// EXPORTS
// ============================================================

export { executeWithRetryAndAuthRefresh };
