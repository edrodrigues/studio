'use server';

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

let globalComposioInstance: Composio | null = null;
let globalGoogleProvider: GoogleProvider | null = null;

function getComposioInstance(apiKey?: string): Composio {
  if (!globalComposioInstance) {
    globalComposioInstance = new Composio({
      apiKey: apiKey || process.env.COMPOSIO_API_KEY,
    });
  }
  return globalComposioInstance;
}

function getGoogleProvider(): GoogleProvider {
  if (!globalGoogleProvider) {
    globalGoogleProvider = new GoogleProvider();
  }
  return globalGoogleProvider;
}

/**
 * Executes a Composio tool and returns the result.
 * Uses the Composio provider's executeToolCall method.
 */
async function executeToolCall(
  composio: Composio,
  provider: GoogleProvider,
  userId: string,
  toolName: string,
  params: Record<string, any>,
  connectedAccountId?: string
): Promise<any> {
  try {
    const result = await (composio as any).executeToolCall(
      userId,
      { name: toolName, arguments: JSON.stringify(params) },
      {
        connectedAccountId,
      }
    );
    return result;
  } catch (error) {
    throw mapComposioError(error, toolName);
  }
}

/**
 * Creates a Composio client for Google Docs/Drive operations
 * Returns an adapter that mirrors google-docs.ts and google-drive.ts signatures
 *
 * Composio SDK v0.6.x API:
 * - composio.connectedAccounts.initiate(userId, authConfigId, options) → starts OAuth
 * - composio.connectedAccounts.list({ userId }) → lists connected accounts
 * - composio.tools.get(entityId, toolName) → gets tool definition
 * - composio.executeToolCall(entityId, toolCall, options) → executes a tool
 */
export async function createComposioClient(
  userId: string,
  config: ComposioClientConfig = {}
): Promise<ComposioClient> {
  const composio = getComposioInstance(config.apiKey);
  const provider = getGoogleProvider();

  // Helper to get connected account for this user
  async function getConnectedAccountId(): Promise<string | undefined> {
    try {
      const accounts = await (composio.connectedAccounts as any).list({ userId });
      const googleAccounts = accounts?.filter(
        (a: any) => a.integrationType === 'google' || a.provider === 'google'
      );
      if (googleAccounts && googleAccounts.length > 0) {
        return googleAccounts[0].id;
      }
      return undefined;
    } catch {
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
        const result = await executeToolCall(
          composio,
          provider,
          userId,
          COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT,
          { document_id: documentId },
          connectedAccountId
        );
        const docData = (result as any)?.data || result;
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
          await executeToolCall(
            composio,
            provider,
            userId,
            COMPOSIO_GOOGLE_TOOLS.DOCS_UPDATE_DOCUMENT,
            { document_id: documentId, ...req },
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
        const result = await executeToolCall(
          composio,
          provider,
          userId,
          COMPOSIO_GOOGLE_TOOLS.DRIVE_GET_FILE,
          { file_id: fileId },
          connectedAccountId
        );
        const data = (result as any)?.data || result;
        return {
          id: data.id || fileId,
          name: data.name || data.title || 'unknown',
          mimeType: data.mimeType || data.mime_type || 'application/vnd.google-apps.document',
        };
      } catch (error) {
        mapGoogleDriveErrorToComposio(error, fileId);
      }
    },

    async copyFile(fileId: string, newName: string): Promise<string> {
      try {
        const connectedAccountId = await getConnectedAccountId();
        const result = await executeToolCall(
          composio,
          provider,
          userId,
          COMPOSIO_GOOGLE_TOOLS.DRIVE_COPY_FILE,
          { file_id: fileId, name: newName },
          connectedAccountId
        );
        const data = (result as any)?.data || result;
        return data.id || data.fileId;
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
        const result = await executeToolCall(
          composio,
          provider,
          userId,
          COMPOSIO_GOOGLE_TOOLS.DRIVE_CREATE_PERMISSION,
          { file_id: fileId, email, role },
          connectedAccountId
        );
        const data = (result as any)?.data || result;
        return {
          fileId,
          permissionId: data.permissionId || data.id || 'unknown',
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
        const accounts = await (composio.connectedAccounts as any).list({ userId });
        if (!accounts || accounts.length === 0) {
          return 'INACTIVE';
        }
        // Find the Google account
        const googleAccount = accounts.find(
          (a: any) => a.integrationType === 'google' || a.provider === 'google'
        );
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
      // Use the GoogleProvider to initiate OAuth via Composio
      const authConfigId = config.googleAuthConfigId || process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
      if (!authConfigId) {
        throw new Error(
          'COMPOSIO_GOOGLE_AUTH_CONFIG_ID not set. ' +
          'Create a Composio integration at https://app.composio.dev and set this env var.'
        );
      }
      const callbackUrl = config.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/composio/callback`;
      try {
        const connectionRequest = await (composio.connectedAccounts as any).initiate(
          userId,
          authConfigId,
          { callbackUrl }
        );
        // The initiate method returns a redirect URL directly
        if (typeof connectionRequest === 'string') {
          return connectionRequest;
        }
        // Or it might return an object with a redirect URL
        return (connectionRequest as any)?.redirectUrl || (connectionRequest as any)?.url || '';
      } catch (error) {
        console.error('[Composio] initiateConnection error:', error);
        throw new Error('Falha ao iniciar conexão com Google. Tente novamente.');
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

function extractTextFromDocument(docData: any): string {
  if (!docData) return '';
  if (typeof docData === 'string') return docData;
  if (docData.body?.content) {
    let text = '';
    docData.body.content.forEach((element: any) => {
      if (element.paragraph?.elements) {
        element.paragraph.elements.forEach((el: any) => {
          if (el.textRun?.content) {
            text += el.textRun.content;
          }
        });
      }
    });
    return text;
  }
  return docData.text || docData.content || docData.body || JSON.stringify(docData);
}

function convertBatchRequestsToComposio(requests: any[]): any[] {
  return requests
    .filter((req) => req.replaceAllText || req.insertText || req.textStyleUpdate)
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
      return req;
    });
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
// MOCKABLE FACTORY (for tests)

