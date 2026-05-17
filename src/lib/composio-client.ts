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
  /** Optional: custom auth config ID for white-label OAuth (Composio managed auth is used by default) */
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
// SESSION MANAGEMENT (Composio v3 pattern)
// ============================================================

// Composio base instance — singleton apenas para o cliente raiz
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForComposio = globalThis as typeof globalThis & {
  __composioBase?: Composio<any>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getComposioBase(): Composio<any> {
  if (!globalForComposio.__composioBase) {
    globalForComposio.__composioBase = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      provider: new GoogleProvider(),
    });
  }
  return globalForComposio.__composioBase;
}

// Cache de sessões por userId — reuso via composio.use(sessionId)
// Key: userId, Value: { sessionId, expiresAt }
const sessionCache = new Map<string, { sessionId: string; expiresAt: number }>();

/**
 * Creates or reuses a Composio session for a user.
 * Follows v3 pattern: composio.create(userId) → session
 * For subsequent requests, uses composio.use(sessionId) for reuse.
 */
async function getOrCreateSession(userId: string): Promise<any> {
  const composio = getComposioBase();
  const cached = sessionCache.get(userId);

  if (cached && cached.expiresAt > Date.now()) {
    try {
      return await composio.use(cached.sessionId);
    } catch {
      // Session may have expired on server, fall through to create
    }
  }

  const session = await composio.create(userId);
  if (session.sessionId) {
    sessionCache.set(userId, { sessionId: session.sessionId, expiresAt: Date.now() + 3600000 });
  }
  return session;
}

/**
 * Clears the session cache for a user, forcing a new session on next request.
 * Exported for use after OAuth completion to ensure fresh session sees new connections.
 */
export function clearSessionCache(userId: string): void {
  sessionCache.delete(userId);
}

/**
 * Clears ALL session caches. Exported for testing only.
 */
export function __clearAllSessionCachesForTesting(): void {
  sessionCache.clear();
  if (globalForComposio.__composioBase) {
    delete globalForComposio.__composioBase;
  }
}

// ============================================================
// TOOL EXECUTION
// ============================================================

/**
 * Executes a Composio tool and returns the result.
 *
 * NOTE: The v3 docs discourage direct tool execution via composio.tools.execute().
 * However, for deterministic operations (document generation, file copies, etc.)
 * where we know exactly which tool to call, this remains the practical approach.
 * The agentic pattern (session.tools() → LLM) is used in composio-gemini.ts.
 */
async function executeTool(
  session: any,
  toolSlug: string,
  params: Record<string, unknown>,
  userId: string,
  requestId?: string
): Promise<unknown> {
  const reqId = requestId || generateRequestId();
  try {
    debugLog(reqId, 'ComposioTool', 'Executing tool', { toolSlug, userId, params: Object.keys(params) });
    const composio = getComposioBase();
    const result = await composio.tools.execute(toolSlug, {
      arguments: params,
      userId,
      version: 'latest',
    });
    debugLog(reqId, 'ComposioTool', 'Tool executed successfully', { toolSlug });
    return result;
  } catch (error) {
    debugError(reqId, 'ComposioTool', `Tool execution failed: ${toolSlug}`, error, { userId });
    throw mapComposioError(error, toolSlug);
  }
}

// ============================================================
// COMPOSIO CLIENT FACTORY
// ============================================================

/**
 * Creates a Composio client for Google Docs/Drive operations.
 * Returns an adapter that mirrors google-docs.ts and google-drive.ts signatures.
 *
 * Uses Composio v3 session-based architecture:
 * - getOrCreateSession(userId) → session per user
 * - session.authorize("GOOGLEDOCS") → OAuth Connect Link for Google Docs
 * - session.authorize("GOOGLEDRIVE") → OAuth Connect Link for Google Drive
 * - session.toolkits() → connection status for both toolkits
 */
export async function createComposioClient(
  userId: string,
  config: ComposioClientConfig = {}
): Promise<ComposioClient> {
  const requestId = generateRequestId();

  debugLog(requestId, 'ComposioClient', 'Client created', { userId, hasApiKey: !!config.apiKey });

  // Helper to get connection status via session.toolkits()
  // Checks both GOOGLEDOCS and GOOGLEDRIVE toolkits
  async function getToolkitStatus(): Promise<ConnectionStatus> {
    try {
      const session = await getOrCreateSession(userId);
      const toolkits = await session.toolkits();
      
      // Debug: Log all available toolkits
      debugLog(requestId, 'ComposioClient', 'getToolkitStatus: all toolkits', { 
        userId, 
        toolkitCount: toolkits?.length || 0,
        toolkits: toolkits?.map((t: any) => ({ slug: t.slug, status: t.status }))
      });
      
      const requiredToolkits = ['GOOGLEDOCS', 'GOOGLEDRIVE'];
      const toolkitStatuses: ConnectionStatus[] = [];

      for (const slug of requiredToolkits) {
        const toolkit = toolkits?.find(
          (t: { slug?: string; name?: string; status?: string }) =>
            t.slug?.toUpperCase() === slug
        );

        if (!toolkit) {
          debugLog(requestId, 'ComposioClient', 'getToolkitStatus: toolkit not found', { userId, slug });
          return 'INACTIVE';
        }

        const status = toolkit.status as ConnectionStatus;
        toolkitStatuses.push(status);
        debugLog(requestId, 'ComposioClient', 'getToolkitStatus', { userId, slug, status });
      }

      // Return the "worst" status among required toolkits
      const priority: ConnectionStatus[] = ['FAILED', 'EXPIRED', 'INACTIVE', 'INITIATED', 'INITIALIZING', 'ACTIVE'];
      let worstStatus: ConnectionStatus = 'ACTIVE';
      for (const status of toolkitStatuses) {
        if (priority.indexOf(status) < priority.indexOf(worstStatus)) {
          worstStatus = status;
        }
      }

      debugLog(requestId, 'ComposioClient', 'getToolkitStatus final', { userId, worstStatus });
      return worstStatus;
    } catch (error) {
      debugError(requestId, 'ComposioClient', 'getToolkitStatus error', error, { userId });
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
        const session = await getOrCreateSession(userId);
        const result = await executeWithRetry(
          () => executeTool(
            session,
            COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT,
            { document_id: documentId },
            userId,
            requestId
          ),
          `getDocumentContent(${documentId})`,
          requestId
        );
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
        const session = await getOrCreateSession(userId);
        const composioRequests = convertBatchRequestsToComposio(requests);

        if (composioRequests.length > 0) {
          await executeWithRetry(
            () => executeTool(
              session,
              COMPOSIO_GOOGLE_TOOLS.DOCS_UPDATE_DOCUMENT,
              {
                document_id: documentId,
                requests: composioRequests
              },
              userId,
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
        const session = await getOrCreateSession(userId);
        const result = await executeWithRetry(
          () => executeTool(
            session,
            COMPOSIO_GOOGLE_TOOLS.DRIVE_GET_FILE,
            { file_id: fileId },
            userId,
            requestId
          ),
          `getFileMetadata(${fileId})`,
          requestId
        );
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
        const session = await getOrCreateSession(userId);
        const result = await executeWithRetry(
          () => executeTool(
            session,
            COMPOSIO_GOOGLE_TOOLS.DRIVE_COPY_FILE,
            {
              file_id: fileId,
              name: newName,
              copy_title: newName,
            },
            userId,
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
        const session = await getOrCreateSession(userId);
        const result = await executeWithRetry(
          () => executeTool(
            session,
            COMPOSIO_GOOGLE_TOOLS.DRIVE_CREATE_PERMISSION,
            {
              file_id: fileId,
              email,
              role,
              permission: {
                type: 'user',
                role,
                emailAddress: email,
              }
            },
            userId,
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
      return getToolkitStatus();
    },

    async initiateConnection(userId: string, returnTo?: string): Promise<string> {
      const baseUrl = (config.callbackUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
        .trim()
        .replace(/\/+$/, '');
      const callbackUrl = new URL(`${baseUrl}/api/composio/callback`);
      if (returnTo && returnTo.startsWith('/')) {
        callbackUrl.searchParams.set('return_to', returnTo);
      }

      if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))) {
        console.warn('[Composio] NEXT_PUBLIC_APP_URL is not set or points to localhost. OAuth callbacks will fail in production.');
      }

      try {
        debugLog(requestId, 'ComposioClient', 'initiateConnection', { userId, returnTo, baseUrl });

        // v3 pattern: session.authorize() for each toolkit → Connect Links
        // Authorize both GOOGLEDOCS and GOOGLEDRIVE (both use Google OAuth)
        const session = await getOrCreateSession(userId);
        const authConfigId = config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;

        const authorizeOptions = {
          callbackUrl: callbackUrl.toString(),
          ...(authConfigId ? { authConfigId } : {}),
        };

        // Authorize Google Docs first
        const docsConnectionRequest = await session.authorize("GOOGLEDOCS", authorizeOptions);
        debugLog(requestId, 'ComposioClient', 'initiateConnection GOOGLEDOCS authorized', { 
          redirectUrl: docsConnectionRequest?.redirectUrl 
        });

        // Then authorize Google Drive
        const driveConnectionRequest = await session.authorize("GOOGLEDRIVE", authorizeOptions);
        debugLog(requestId, 'ComposioClient', 'initiateConnection GOOGLEDRIVE authorized', { 
          redirectUrl: driveConnectionRequest?.redirectUrl 
        });

        // Return the first redirect URL - user will authenticate once for both Google toolkits
        const redirectUrl = docsConnectionRequest?.redirectUrl;
        if (!redirectUrl) {
          throw new Error('Composio did not return a redirect URL for OAuth.');
        }
        debugLog(requestId, 'ComposioClient', 'initiateConnection success', { redirectUrl });
        return redirectUrl;
      } catch (error) {
        debugError(requestId, 'ComposioClient', 'initiateConnection failed', error, { userId, returnTo });
        const sdkMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Falha ao iniciar conexão com Google Docs/Drive: ${sdkMessage}`);
      }
    },

    async checkConnection(userId: string): Promise<{ connected: boolean; status: ConnectionStatus }> {
      debugLog(requestId, 'ComposioClient', 'checkConnection', { userId });
      const status = await getToolkitStatus();
      const result = {
        connected: status === 'ACTIVE',
        status,
      };
      debugLog(requestId, 'ComposioClient', 'checkConnection result', result);
      return result;
    },

    clearConnectedAccountIdCache(userId: string): void {
      debugLog(requestId, 'ComposioClient', 'clearConnectedAccountIdCache', { userId });
      clearSessionCache(userId);
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

      clearSessionCache(userId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      return executeWithRetryAndAuthRefresh(fn, context, userId, requestId, retries - 1);
    }

    const isRateLimit =
      (error instanceof Error && error.message?.includes('429')) ||
      (error as any)?.status === 429 ||
      (error as any)?.code === 'rateLimitExceeded';

    if (isRateLimit && retries > 0) {
      const delay = 200 * (3 - retries);
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
