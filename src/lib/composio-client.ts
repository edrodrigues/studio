import { Composio } from '@composio/core';
import { GoogleProvider } from '@composio/google';
import {
  COMPOSIO_GOOGLE_TOOLS,
  type ComposioFileMetadata,
  type ComposioShareResult,
  mapComposioError,
  mapComposioDriveError,
} from './composio-tools-mapping';
import type { TemplatePlaceholderDefinition } from './google-docs';
import type { ConnectionStatus } from './composio-types';

// Re-export ConnectionStatus for consumers of composio-client
export type { ConnectionStatus } from './composio-types';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

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
  initiateConnection(userId: string): Promise<string>; // returns redirect URL
  checkConnection(userId: string): Promise<{ connected: boolean; status: ConnectionStatus }>;
}

// ============================================================
// COMPOSIO CLIENT IMPLEMENTATION
// ============================================================

const globalForComposio = globalThis as typeof globalThis & {
  __composioInstance?: Composio;
};

function getComposioInstance(apiKey?: string): Composio {
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
  connectedAccountId?: string
): Promise<unknown> {
  try {
    const result = await composio.tools.execute(toolSlug, {
      connectedAccountId,
      arguments: params,
      userId,
    });
    return result;
  } catch (error) {
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

  // Helper to get connected account for this user
  async function getConnectedAccountId(): Promise<string | undefined> {
    // Prefer authConfigId from config if available (no filtering needed)
    if (config.googleAuthConfigId) {
      // If we have authConfigId, the connected account ID IS the authConfigId for this integration
      // But we need to list accounts to find the actual connectedAccountId
      // Use the authConfigId as an authConfig.id filter for precise matching
      try {
        const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
        const matched = accounts?.items?.find(
          (a: { authConfig?: { id?: string }; id?: string }) =>
            a.authConfig?.id === config.googleAuthConfigId
        );
        return matched?.id;
      } catch (error) {
        console.error('[Composio] getConnectedAccountId error:', error);
        return undefined;
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
        return googleAccounts[0].id;
      }
      return undefined;
    } catch (error) {
      console.error('[Composio] getConnectedAccountId error:', error);
      return undefined;
    }
  }

  return {
    // ------------------------------------------------
    // Docs operations
    // ------------------------------------------------

    async getDocumentContent(documentId: string): Promise<string> {
      try {
        const connectedAccountId = await getConnectedAccountId();
        const result = await executeTool(
          composio,
          COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT,
          { document_id: documentId },
          userId,
          connectedAccountId
        );
        const docData = (result as { data?: unknown })?.data ?? result;
        return extractTextFromDocument(docData);
      } catch (error) {
        mapGoogleDocsErrorToComposio(error, documentId);
      }
    },

    async getDocumentPlaceholders(documentId: string): Promise<TemplatePlaceholderDefinition[]> {
      // GAP: No Composio tool for placeholder extraction
      // Use local implementation (same as google-docs.ts)
      const self = this as ComposioClient;
      const { extractPlaceholderDefinitionsFromText } = await import('./google-docs');
      const content = await self.getDocumentContent(documentId);
      return extractPlaceholderDefinitionsFromText(content);
    },

    async batchUpdateDocument(documentId: string, requests: any[]): Promise<void> {
      try {
        const connectedAccountId = await getConnectedAccountId();
        const composioRequests = convertBatchRequestsToComposio(requests);
        for (const req of composioRequests) {
          await executeTool(
            composio,
            COMPOSIO_GOOGLE_TOOLS.DOCS_UPDATE_DOCUMENT,
            { document_id: documentId, ...req },
            userId,
            connectedAccountId
          );
        }
      } catch (error) {
        mapGoogleDocsErrorToComposio(error, documentId);
      }
    },

    // ------------------------------------------------
    // Drive operations
    // ------------------------------------------------

    async getFileMetadata(fileId: string): Promise<ComposioFileMetadata> {
      try {
        const connectedAccountId = await getConnectedAccountId();
        const result = await executeTool(
          composio,
          COMPOSIO_GOOGLE_TOOLS.DRIVE_GET_FILE,
          { file_id: fileId },
          userId,
          connectedAccountId
        );
        const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>);
        return {
          id: (data.id as string) || fileId,
          name: (data.name as string) || (data.title as string) || 'unknown',
          mimeType: (data.mimeType as string) || (data.mime_type as string) || 'application/vnd.google-apps.document',
        };
      } catch (error) {
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async copyFile(fileId: string, newName: string): Promise<string> {
      try {
        const connectedAccountId = await getConnectedAccountId();
        const result = await executeTool(
          composio,
          COMPOSIO_GOOGLE_TOOLS.DRIVE_COPY_FILE,
          { file_id: fileId, name: newName },
          userId,
          connectedAccountId
        );
        const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>);
        return (data.id as string) || (data.fileId as string);
      } catch (error) {
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async shareFile(
      fileId: string,
      email: string,
      role: 'writer' | 'commenter' | 'reader' = 'writer'
    ): Promise<ComposioShareResult> {
      try {
        const connectedAccountId = await getConnectedAccountId();
        const result = await executeTool(
          composio,
          COMPOSIO_GOOGLE_TOOLS.DRIVE_CREATE_PERMISSION,
          { file_id: fileId, email, role },
          userId,
          connectedAccountId
        );
        const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>);
        return {
          fileId,
          permissionId: (data.permissionId as string) || (data.id as string) || 'unknown',
        };
      } catch (error) {
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    // ------------------------------------------------
    // Connection management
    // ------------------------------------------------

    async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
      try {
        const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
        const items = accounts?.items ?? accounts;
        if (!items || items.length === 0) {
          return 'INACTIVE';
        }

        const authConfigId = config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;

        // Prefer authConfigId-based lookup if available (most precise)
        let googleAccount: { status?: string; authConfig?: { id?: string }; toolkit?: { slug?: string; name?: string } } | undefined;

        if (authConfigId) {
          googleAccount = items.find(
            (a: { authConfig?: { id?: string }; status?: string }) =>
              a.authConfig?.id === authConfigId
          );
        }

        // Fallback: match by toolkit slug/name
        if (!googleAccount) {
          googleAccount = items.find(
            (a: { toolkit?: { slug?: string; name?: string }; status?: string }) =>
              a.toolkit?.slug?.toLowerCase() === 'google' ||
              a.toolkit?.slug?.toLowerCase() === 'googleworkspace' ||
              a.toolkit?.name?.toLowerCase() === 'google' ||
              a.toolkit?.name?.toLowerCase() === 'google workspace'
          );
        }

        if (!googleAccount) {
          return 'INACTIVE';
        }
        const status = googleAccount.status;
        if (status === 'ACTIVE') return 'ACTIVE';
        if (status === 'INITIATED') return 'INITIATED';
        if (status === 'EXPIRED') return 'EXPIRED';
        if (status === 'INACTIVE') return 'INACTIVE';
        return 'FAILED';
      } catch {
        return 'FAILED';
      }
    },

    async initiateConnection(userId: string): Promise<string> {
      const authConfigId = config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
      if (!authConfigId) {
        throw new Error(
          'COMPOSIO_GOOGLE_AUTH_CONFIG_ID not set. ' +
          'Create a Composio integration at https://app.composio.dev and set this env var.'
        );
      }
      const callbackUrl = config.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/composio/callback`;

      if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))) {
        console.warn('[Composio] NEXT_PUBLIC_APP_URL is not set or points to localhost. OAuth callbacks will fail in production.');
      }

      try {
        const connectionRequest = await composio.connectedAccounts.initiate(
          userId,
          authConfigId,
          { callbackUrl: callbackUrl, allowMultiple: true }
        );
        const redirectUrl = connectionRequest?.redirectUrl;
        if (!redirectUrl) {
          throw new Error('Composio did not return a redirect URL for OAuth.');
        }
        console.info('[Composio] initiateConnection redirect:', redirectUrl);
        return redirectUrl;
      } catch (error) {
        const sdkMessage = error instanceof Error ? error.message : String(error);
        console.error('[Composio] initiateConnection error:', error);
        throw new Error(`Falha ao iniciar conexão com Google: ${sdkMessage}`);
      }
    },

    async checkConnection(userId: string): Promise<{ connected: boolean; status: ConnectionStatus }> {
      const self = this as ComposioClient;
      const status = await self.getConnectionStatus(userId);
      return {
        connected: status === 'ACTIVE',
        status,
      };
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
  return requests
    .filter((req) => req.replaceAllText || req.insertText)
    .map((req) => {
      if (req.replaceAllText) {
        return {
          replace_all_text: {
            replace_text: req.replaceAllText.replaceText.text || req.replaceAllText.replaceText,
            target_text: req.replaceAllText.containingText?.content || req.replaceAllText.containingText,
          },
        };
      }
      if (req.insertText) {
        return {
          insert_text: {
            text: req.insertText.text,
            location: req.insertText.location,
          },
        };
      }
      return null;
    })
    .filter(Boolean);
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
