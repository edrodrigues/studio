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
  /** Optional: custom auth config ID specifically for Google Docs */
  googleDocsAuthConfigId?: string;
  /** Optional: custom auth config ID specifically for Google Drive */
  googleDriveAuthConfigId?: string;
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
// SHARED SESSION CONFIG (single source of truth)
// ============================================================

export interface SessionConfig {
  toolkits: string[];
  tools: {
    googledocs: { enable: string[] };
    googledrive: { enable: string[] };
  };
  authConfigs: {
    googledocs: string;
    googledrive: string;
  };
  manageConnections: {
    waitForConnections: boolean;
  };
}

/**
 * Returns the canonical session config for Google Docs/Drive.
 * Both composio-client.ts and composio-gemini.ts use this to stay in sync.
 */
export function buildSessionConfig(
  docsAuthConfigId: string,
  driveAuthConfigId: string,
  waitForConnections = true
): SessionConfig {
  return {
    toolkits: ['googledocs', 'googledrive'],
    tools: {
      googledocs: {
        enable: [
          'GOOGLEDOCS_COPY_DOCUMENT',
          'GOOGLEDOCS_CREATE_DOCUMENT',
          'GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN',
          'GOOGLEDOCS_CREATE_DOCUMENT2',
          'GOOGLEDOCS_CREATE_FOOTER',
          'GOOGLEDOCS_CREATE_FOOTNOTE',
          'GOOGLEDOCS_CREATE_HEADER',
          'GOOGLEDOCS_SEARCH_DOCUMENTS',
          'GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT',
          'GOOGLEDOCS_REPLACE_ALL_TEXT',
          'GOOGLEDOCS_GET_DOCUMENT_BY_ID',
          'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
        ],
      },
      googledrive: {
        enable: [
          'GOOGLEDRIVE_GET_FILE_V2',
          'GOOGLEDRIVE_COPY_FILE_ADVANCED',
          'GOOGLEDRIVE_CREATE_PERMISSION',
        ],
      },
    },
    authConfigs: {
      googledocs: docsAuthConfigId,
      googledrive: driveAuthConfigId,
    },
    manageConnections: {
      waitForConnections,
    },
  };
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
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error('[Composio] COMPOSIO_API_KEY is not set — all API calls will fail');
    throw new Error('Composio API key is not configured. Set COMPOSIO_API_KEY environment variable.');
  }

  if (!globalForComposio.__composioBase) {
    globalForComposio.__composioBase = new Composio({
      apiKey,
      provider: new GoogleProvider(),
    });
  }
  return globalForComposio.__composioBase;
}

// Cache de sessões por userId — reuso via composio.use(sessionId)
// Key: userId, Value: { sessionId, createdAt }
// Note: Sessions persist on the server and don't expire (per Composio v3 docs),
// but we add a 55-minute TTL to prevent unbounded memory growth in serverless.
const SESSION_CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes
const MAX_CACHE_SIZE = 1000;

interface CacheEntry {
  sessionId: string;
  createdAt: number;
}

const sessionCache = new Map<string, CacheEntry>();

function isEntryExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.createdAt > SESSION_CACHE_TTL_MS;
}

function evictOldestIfNeeded(): void {
  if (sessionCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey) sessionCache.delete(oldestKey);
  }
}

/**
 * Creates or reuses a Composio session for a user.
 * Follows v3 pattern: composio.create(userId) → session
 * For subsequent requests, uses composio.use(sessionId) for reuse.
 *
 * authConfigId is passed during session creation (not during authorize),
 * per the official SDK docs: https://docs.composio.dev/reference/sdk-reference/typescript/tool-router-session
 */
async function getOrCreateSession(
  userId: string,
  docsAuthConfigId?: string,
  driveAuthConfigId?: string
): Promise<any> {
  const composio = getComposioBase();
  const cached = sessionCache.get(userId);

  if (cached && !isEntryExpired(cached)) {
    try {
      return await composio.use(cached.sessionId);
    } catch {
      // Session may have been invalidated on server, fall through to create
    }
  }

  // Evict expired or oldest entry if cache is full
  if (cached && isEntryExpired(cached)) {
    sessionCache.delete(userId);
  }
  evictOldestIfNeeded();

  const effectiveDocsAuthConfigId = docsAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
  const effectiveDriveAuthConfigId = driveAuthConfigId || process.env.COMPOSIO_GOOGLEDRIVE_AUTH_CONFIG_ID || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
  if (!effectiveDocsAuthConfigId || !effectiveDriveAuthConfigId) {
    throw new Error(
      'COMPOSIO_GOOGLE_AUTH_CONFIG_ID environment variable must be set. ' +
      'Set it to your Composio Google auth config ID to configure OAuth.'
    );
  }

  const createOptions = buildSessionConfig(effectiveDocsAuthConfigId, effectiveDriveAuthConfigId);

  const SESSION_CREATION_TIMEOUT_MS = 15000;
  const session = await Promise.race([
    composio.create(userId, createOptions),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Composio session creation timed out after ${SESSION_CREATION_TIMEOUT_MS / 1000}s`)), SESSION_CREATION_TIMEOUT_MS)
    ),
  ]);
  if (session.sessionId) {
    sessionCache.set(userId, { sessionId: session.sessionId, createdAt: Date.now() });
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
 * Uses the recommended SDK pattern (per docs §2.3):
 *   session.toolkit(toolkitSlug).tool(toolSlug).execute(params)
 * Falls back to session.tools.execute() if the recommended API is unavailable.
 */
function resolveToolkitSlug(toolSlug: string): string {
  if (toolSlug.startsWith('GOOGLEDOCS_')) return 'googledocs';
  if (toolSlug.startsWith('GOOGLEDRIVE_')) return 'googledrive';
  return toolSlug.split('_')[0].toLowerCase();
}

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

    // Try recommended SDK pattern first: session.toolkit(slug).tool(slug).execute(params)
    const toolkitSlug = resolveToolkitSlug(toolSlug);
    try {
      const toolkit = session.toolkit?.(toolkitSlug);
      if (toolkit?.tool) {
        const tool = toolkit.tool(toolSlug);
        if (tool?.execute) {
          const result = await tool.execute(params);
          debugLog(reqId, 'ComposioTool', 'Tool executed successfully (recommended API)', { toolSlug });
          return result;
        }
      }
    } catch {
      // Fall through to legacy API
    }

    // Fallback: session.tools.execute() (discouraged but still supported)
    debugLog(reqId, 'ComposioTool', 'Falling back to session.tools.execute()', { toolSlug });
    const result = await session.tools.execute(toolSlug, {
      arguments: params,
      version: 'latest',
    });
    debugLog(reqId, 'ComposioTool', 'Tool executed successfully (fallback API)', { toolSlug });
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

  // Helper to check connection status via connectedAccounts.list()
  // This directly queries for active connections rather than relying on session.toolkits()
  // which doesn't attach to existing connections on new sessions.
  async function getToolkitStatus(): Promise<ConnectionStatus> {
    try {
      const composio = getComposioBase();
      const response = await composio.connectedAccounts.list({
        userIds: [userId],
        toolkitSlugs: ['googledocs', 'googledrive'],
      });

      debugLog(requestId, 'ComposioClient', 'getToolkitStatus: connected accounts', {
        userId,
        accountCount: response?.items?.length || 0,
        accounts: response?.items?.map((a: any) => ({ id: a.id, toolkit: a.toolkit, status: a.status })),
      });

      if (!response?.items?.length) {
        debugLog(requestId, 'ComposioClient', 'getToolkitStatus: no connected accounts found', { userId });
        return 'INACTIVE';
      }

      const requiredToolkits = ['googledocs', 'googledrive'];
      const activeToolkits = new Set<string>();

      for (const account of response.items) {
        if (account.status === 'ACTIVE' && account.toolkit?.slug) {
          activeToolkits.add(account.toolkit.slug.toLowerCase());
        }
      }

      const allActive = requiredToolkits.every((slug) => activeToolkits.has(slug));
      const anyActive = requiredToolkits.some((slug) => activeToolkits.has(slug));

      if (allActive) {
        debugLog(requestId, 'ComposioClient', 'getToolkitStatus: all toolkits active', { userId });
        return 'ACTIVE';
      }

      if (anyActive) {
        debugLog(requestId, 'ComposioClient', 'getToolkitStatus: some toolkits active', { userId, activeToolkits: [...activeToolkits] });
        return 'INITIATED';
      }

      return 'INACTIVE';
    } catch (error) {
      debugError(requestId, 'ComposioClient', 'getToolkitStatus error', error, { userId });
      return 'FAILED';
    }
  }

  // Wrapper with timeout and retry to prevent indefinite hanging and handle transient network errors
  async function getToolkitStatusWithTimeout(timeoutMs: number = 10000, maxRetries: number = 2): Promise<ConnectionStatus> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const timeoutPromise = new Promise<ConnectionStatus>((_, reject) =>
        setTimeout(() => reject(new Error(`Connection check timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      try {
        return await Promise.race([getToolkitStatus(), timeoutPromise]);
      } catch (error) {
        const isNetworkError = error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('connect') ||
          error.message.includes('refused') ||
          error.message.includes('network') ||
          error.message.includes('ECONNREFUSED')
        );

        if (isNetworkError && attempt < maxRetries) {
          const delay = 1000 * (attempt + 1);
          debugError(requestId, 'ComposioClient', `Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, error, { userId });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        debugError(requestId, 'ComposioClient', 'getToolkitStatusWithTimeout error', error, { userId });
        return 'FAILED';
      }
    }

    return 'FAILED';
  }

  const docsAuthConfigId = config.googleDocsAuthConfigId || config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
  const driveAuthConfigId = config.googleDriveAuthConfigId || config.googleAuthConfigId || process.env.COMPOSIO_GOOGLEDRIVE_AUTH_CONFIG_ID || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
  if (!docsAuthConfigId || !driveAuthConfigId) {
    throw new Error(
      'COMPOSIO_GOOGLE_AUTH_CONFIG_ID environment variable must be set. ' +
      'Set it to configure OAuth.'
    );
  }

  return {
    // ------------------------------------------------
    // Docs operations
    // ------------------------------------------------

    async getDocumentContent(documentId: string): Promise<string> {
      try {
        debugLog(requestId, 'ComposioClient', 'getDocumentContent', { documentId, userId });
        const session = await getOrCreateSession(userId, docsAuthConfigId, driveAuthConfigId);
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
        throw mapGoogleDocsErrorToComposio(error, documentId);
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
        const session = await getOrCreateSession(userId, docsAuthConfigId, driveAuthConfigId);
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
        throw mapGoogleDocsErrorToComposio(error, documentId);
      }
    },

    // ------------------------------------------------
    // Drive operations
    // ------------------------------------------------

    async getFileMetadata(fileId: string): Promise<ComposioFileMetadata> {
      try {
        debugLog(requestId, 'ComposioClient', 'getFileMetadata', { fileId, userId });
        const session = await getOrCreateSession(userId, docsAuthConfigId, driveAuthConfigId);
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
        throw mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async copyFile(fileId: string, newName: string): Promise<string> {
      try {
        debugLog(requestId, 'ComposioClient', 'copyFile', { fileId, newName, userId });
        const session = await getOrCreateSession(userId, docsAuthConfigId, driveAuthConfigId);
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
        throw mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async shareFile(
      fileId: string,
      email: string,
      role: 'writer' | 'commenter' | 'reader' = 'writer'
    ): Promise<ComposioShareResult> {
      try {
        debugLog(requestId, 'ComposioClient', 'shareFile', { fileId, email, role, userId });
        const session = await getOrCreateSession(userId, docsAuthConfigId, driveAuthConfigId);
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
        throw mapGoogleDriveErrorToComposio(error, fileId);
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
        // Note: authConfigId is passed during session.create(), not during authorize()
        // per SDK docs: https://docs.composio.dev/reference/sdk-reference/typescript/tool-router-session
        const session = await getOrCreateSession(userId, docsAuthConfigId, driveAuthConfigId);

        const authorizeOptions = {
          callbackUrl: callbackUrl.toString(),
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

        // Return the first redirect URL.
        // NOTE: Both GOOGLEDOCS and GOOGLEDRIVE use the same underlying Google OAuth account.
        // When the user authenticates via the Docs redirect, Composio automatically links the
        // same Google account to the Drive toolkit as well (same connectedAccountId).
        // A single OAuth flow is sufficient — no need to chain redirects.
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
      const status = await getToolkitStatusWithTimeout();
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
// CONSOLIDATED RETRY LOGIC (rate limits + auth refresh)
// ============================================================

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
  userId?: string,
  requestId?: string,
  maxRetries = 3
): Promise<T> {
  const reqId = requestId || generateRequestId();
  const rateLimitBackoff = [100, 200, 400];
  let authRetries = maxRetries;

  debugLog(reqId, 'ComposioRetry', `Starting consolidated retry loop`, { context, maxRetries });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Check for auth errors first
      const isAuthError =
        (error instanceof Error && (error.message?.includes('401') || error.message?.includes('AUTH_EXPIRED') || error.message?.includes('unauthorized'))) ||
        (error as any)?.status === 401 ||
        (error as any)?.code === 'AUTH_EXPIRED';

      if (isAuthError && authRetries > 0 && userId) {
        debugLog(reqId, 'ComposioRetry', `Auth error detected, clearing cache and retrying (${authRetries} attempts left)`, {
          context,
          userId,
        });

        clearSessionCache(userId);
        await new Promise((resolve) => setTimeout(resolve, 100));
        authRetries--;
        continue;
      }

      // Check for rate limit errors
      const isRateLimit =
        (error instanceof Error && error.message?.includes('429')) ||
        (error as any)?.status === 429 ||
        (error as any)?.code === 'rateLimitExceeded' ||
        JSON.stringify(error).includes('rateLimitExceeded');

      if (isRateLimit && attempt < maxRetries) {
        const delay = rateLimitBackoff[attempt] || rateLimitBackoff[rateLimitBackoff.length - 1];
        debugLog(reqId, 'ComposioRetry', `Rate limit hit on ${context}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      debugError(reqId, 'ComposioRetry', `Max retries exceeded or non-retryable error for ${context}`, error);
      throw error;
    }
  }

  throw new Error(`[Composio] Max retries exceeded for ${context}`);
}

// Keep executeWithRetryAndAuthRefresh as an alias for backward compatibility
async function executeWithRetryAndAuthRefresh<T>(
  fn: () => Promise<T>,
  context: string,
  userId: string,
  requestId: string,
  retries = 2
): Promise<T> {
  return executeWithRetry(fn, context, userId, requestId, retries);
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
