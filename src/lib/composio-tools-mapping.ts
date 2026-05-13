/**
 * Composio Tool Coverage Mapping
 * Maps all current googleapis operations to Composio SDK equivalents
 * Created: 2026-04-21
 *
 * Scope: google-docs.ts + google-drive.ts → Composio tools
 * Gaps are explicitly marked with fallback strategies
 */

import type { TemplatePlaceholderDefinition } from './google-docs';

/**
 * Composio tool actions for Google Docs/Drive
 * See: https://docs.composio.dev/reference/api-reference/mcp
 */
export const COMPOSIO_GOOGLE_TOOLS = {
  // Google Docs tools (UPPERCASE versioned slugs per Composio v0.6.x)
  DOCS_GET_DOCUMENT: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
  DOCS_UPDATE_DOCUMENT: 'GOOGLEDOCS_UPDATE_DOCUMENT_BATCH',
  DOCS_CREATE_DOCUMENT: 'GOOGLEDOCS_CREATE_DOCUMENT',

  // Google Drive tools (UPPERCASE versioned slugs per Composio v0.6.x)
  DRIVE_GET_FILE: 'GOOGLEDRIVE_GET_FILE_V2',
  DRIVE_COPY_FILE: 'GOOGLEDRIVE_COPY_FILE_ADVANCED',
  DRIVE_CREATE_PERMISSION: 'GOOGLEDRIVE_CREATE_PERMISSION',
  DRIVE_LIST_FILES: 'GOOGLEDRIVE_LIST_FILES',
  DRIVE_GET_PERMISSIONS: 'GOOGLEDRIVE_GET_PERMISSIONS',
} as const;

export type ComposioGoogleTool = (typeof COMPOSIO_GOOGLE_TOOLS)[keyof typeof COMPOSIO_GOOGLE_TOOLS];

/**
 * GAP: Operations Composio does NOT support directly
 * Fallback strategy for each gap
 */
export const COMPOSIO_GAPS = {
  /**
   * GAP: getDocumentPlaceholders()
   * Composio: NO direct tool for placeholder extraction
   * Fallback: Keep local implementation using extractPlaceholderDefinitionsFromText()
   * Risk: LOW — pure text parsing, no API call needed
   */
  getDocumentPlaceholders: {
    composioEquivalent: null,
    fallback: 'local',
    fallbackImpl: 'extractPlaceholderDefinitionsFromText() from google-docs.ts',
    risk: 'low',
    reason: 'Text parsing operation — no API call needed, can use existing local function',
  },

  /**
   * GAP: batchUpdateDocument() structural replacements
   * Composio: YES (google_googleadocsupdatedocs) but limited to text replacements
   * Fallback: Composio handles most cases; complex structural changes may need googleapis
   * Risk: MEDIUM — some edge cases may require googleapis fallback
   */
  batchUpdateDocument: {
    composioEquivalent: COMPOSIO_GOOGLE_TOOLS.DOCS_UPDATE_DOCUMENT,
    fallback: 'composio_primary',
    gapNote: 'Composio supports text replaces. Complex structural edits (tables, lists) may need googleapis.',
    risk: 'medium',
    reason: 'Most batch updates are simple text replacements which Composio handles',
  },

  /**
   * GAP: getFileMetadata() with mimeType validation
   * Composio: YES (googlegoogledriveget_file) returns metadata
   * Fallback: N/A — Composio covers this
   * Risk: LOW
   */
  getFileMetadata: {
    composioEquivalent: COMPOSIO_GOOGLE_TOOLS.DRIVE_GET_FILE,
    fallback: null,
    risk: 'low',
  },

  /**
   * GAP: shareFile() permission creation
   * Composio: YES (googlegoogledrivecreate_permission)
   * Fallback: N/A — Composio covers this
   * Risk: LOW
   */
  shareFile: {
    composioEquivalent: COMPOSIO_GOOGLE_TOOLS.DRIVE_CREATE_PERMISSION,
    fallback: null,
    risk: 'low',
  },
} as const;

// ============================================================
// OPERATION MAPPINGS
// ============================================================

export interface ToolMapping {
  /** Original function name in googleapis layer */
  originalFunction: string;
  /** Composio tool action name */
  composioTool: ComposioGoogleTool | null;
  /** Whether this operation has a Composio equivalent */
  hasComposioEquiv: boolean;
  /** Fallback strategy */
  fallback: 'composio' | 'googleapis' | 'local' | null;
  /** Notes about the mapping */
  notes?: string;
}

export const TOOL_MAPPINGS: Record<string, ToolMapping> = {
  // --- google-docs.ts ---
  getDocumentContent: {
    originalFunction: 'getDocumentContent',
    composioTool: COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT,
    hasComposioEquiv: true,
    fallback: 'composio',
    notes: 'Returns document text content. Composio google_googleadocsgetdocs covers this.',
  },

  getDocumentPlaceholders: {
    originalFunction: 'getDocumentPlaceholders',
    composioTool: null,
    hasComposioEquiv: false,
    fallback: 'local',
    notes: 'Gap: No Composio tool for placeholder extraction. Use local extractPlaceholderDefinitionsFromText().',
  },

  batchUpdateDocument: {
    originalFunction: 'batchUpdateDocument',
    composioTool: COMPOSIO_GOOGLE_TOOLS.DOCS_UPDATE_DOCUMENT,
    hasComposioEquiv: true,
    fallback: 'composio',
    notes: 'Composio handles text replacements. Complex structural edits may need googleapis fallback.',
  },

  extractPlaceholderDefinitionsFromText: {
    originalFunction: 'extractPlaceholderDefinitionsFromText',
    composioTool: null,
    hasComposioEquiv: false,
    fallback: 'local',
    notes: 'Pure text parsing — no API call. Keep as-is, not affected by Composio migration.',
  },

  // --- google-drive.ts ---
  getFileMetadata: {
    originalFunction: 'getFileMetadata',
    composioTool: COMPOSIO_GOOGLE_TOOLS.DRIVE_GET_FILE,
    hasComposioEquiv: true,
    fallback: 'composio',
    notes: 'Returns {id, name, mimeType}. Composio get_file covers this.',
  },

  copyFile: {
    originalFunction: 'copyFile',
    composioTool: COMPOSIO_GOOGLE_TOOLS.DRIVE_COPY_FILE,
    hasComposioEquiv: true,
    fallback: 'composio',
    notes: 'Copies a file to create a new instance. Composio copy_file covers this.',
  },

  shareFile: {
    originalFunction: 'shareFile',
    composioTool: COMPOSIO_GOOGLE_TOOLS.DRIVE_CREATE_PERMISSION,
    hasComposioEquiv: true,
    fallback: 'composio',
    notes: 'Creates permission (share with email). Composio create_permission covers this.',
  },
} as const;

// ============================================================
// ERROR MAPPING: Composio errors → Portuguese messages
// ============================================================

export interface ComposioErrorMapping {
  composioErrorPattern: string | RegExp;
  errorType: string;
  portugueseMessage: string;
}

export const COMPOSIO_ERROR_MAPPINGS: ComposioErrorMapping[] = [
  {
    composioErrorPattern: /notFound|404|DOCUMENT_NOT_FOUND/i,
    errorType: 'TEMPLATE_NOT_FOUND',
    portugueseMessage:
      'TEMPLATE_NOT_FOUND: O documento não foi encontrado no Google Docs (ID: {id}). Verifique se:\n1. O arquivo existe e não foi deletado\n2. Você tem permissão para acessá-lo\n3. O link do documento está correto',
  },
  {
    composioErrorPattern: /forbidden|403|PERMISSION_DENIED|permissionDenied/i,
    errorType: 'PERMISSION_DENIED',
    portugueseMessage:
      'PERMISSION_DENIED: Sem permissão para acessar o documento (ID: {id}). Verifique se:\n1. O arquivo foi compartilhado com você\n2. Você está logado com a conta correta\n3. O arquivo não está em modo restrito',
  },
  {
    composioErrorPattern: /unauthorized|401|Invalid Credentials|AUTH_EXPIRED/i,
    errorType: 'AUTH_EXPIRED',
    portugueseMessage:
      'AUTH_EXPIRED: Sessão expirada ou inválida. Por favor, faça login novamente com sua conta Google.',
  },
  {
    composioErrorPattern: /badRequest|400|Invalid|ID inválido/i,
    errorType: 'INVALID_REQUEST',
    portugueseMessage:
      'INVALID_REQUEST: ID do documento inválido ({id}). Verifique se o link do documento está correto.',
  },
  {
    composioErrorPattern: /rateLimitExceeded|429|Rate limit/i,
    errorType: 'RATE_LIMITED',
    portugueseMessage:
      'RATE_LIMITED: Muitas requisições ao Google Docs. Aguarde alguns segundos e tente novamente.',
  },
  // New: Tool/config specific errors
  {
    composioErrorPattern: /tool.*not found|invalid.*tool|slug.*not found|COMPOSIO_TOOL_NOT_FOUND/i,
    errorType: 'INVALID_REQUEST',
    portugueseMessage:
      'INVALID_REQUEST: A ferramenta Composio não foi encontrada (slug: {id}). Verifique se:\n1. O Composio está configurado corretamente\n2. As credenciais da API Composio estão válidas\n3. O slug da ferramenta está correto (use maiúsculas, ex: GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT)',
  },
  {
    composioErrorPattern: /connectedAccount.*not found|account.*not found|COMPOSIO_ACCOUNT_NOT_FOUND/i,
    errorType: 'AUTH_EXPIRED',
    portugueseMessage:
      'AUTH_EXPIRED: Conta Google não conectada ao Composio. Por favor:\n1. Conecte sua conta Google em Configurações\n2. Verifique se a conexão não expirou\n3. Tente reconectar se necessário',
  },
  {
    composioErrorPattern: /invalid.*argument|missing.*required|COMPOSIO_INVALID_PARAMS/i,
    errorType: 'INVALID_REQUEST',
    portugueseMessage:
      'INVALID_REQUEST: Parâmetros inválidos para a ferramenta Composio. Verifique se os dados enviados estão corretos.',
  },
  {
    composioErrorPattern: /TOOL_VERSION_REQUIRED|TS-SDK::TOOL_VERSION_REQUIRED/i,
    errorType: 'INVALID_REQUEST',
    portugueseMessage:
      'INVALID_REQUEST: A versão da ferramenta Composio não foi especificada. Isso pode indicar uma incompatibilidade de versão do SDK. Verifique se:\n1. O SDK @composio/core está atualizado\n2. A configuração da ferramenta no dashboard Composio está correta\n3. O ambiente (production/staging) está correto',
  },
];

/**
 * Maps a Composio error to a Portuguese error message
 */
export function mapComposioError(error: unknown, documentId?: string): Error {
  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  const errorCode = (error as any)?.code || (error as any)?.status || '';

  for (const mapping of COMPOSIO_ERROR_MAPPINGS) {
    const pattern =
      mapping.composioErrorPattern instanceof RegExp
        ? mapping.composioErrorPattern
        : new RegExp(mapping.composioErrorPattern, 'i');

    if (pattern.test(errorMessage) || pattern.test(String(errorCode))) {
      const message = mapping.portugueseMessage.replace('{id}', documentId || 'unknown');
      return new Error(message);
    }
  }

  return new Error(
    `GOOGLE_DOCS_ERROR: Erro ao acessar documento. ${errorMessage} (Código: ${errorCode || 'unknown'})`
  );
}

/**
 * Maps a Composio Drive error to a Portuguese error message
 */
export function mapComposioDriveError(error: unknown, fileId?: string): Error {
  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  const errorCode = (error as any)?.code || (error as any)?.status || '';

  for (const mapping of COMPOSIO_ERROR_MAPPINGS) {
    const pattern =
      mapping.composioErrorPattern instanceof RegExp
        ? mapping.composioErrorPattern
        : new RegExp(mapping.composioErrorPattern, 'i');

    if (pattern.test(errorMessage) || pattern.test(String(errorCode))) {
      const message = mapping.portugueseMessage.replace('{id}', fileId || 'unknown');
      // Swap context to Drive if it's a Drive error
      const driveMessage = message.replace('documento', 'template').replace('Documento', 'Template');
      return new Error(driveMessage);
    }
  }

  return new Error(
    `GOOGLE_DRIVE_ERROR: Erro ao acessar template. ${errorMessage} (Código: ${errorCode || 'unknown'})`
  );
}

// ============================================================
// TYPE EXPORTS for composio-client.ts
// ============================================================

export interface ComposioDocumentContent {
  documentId: string;
  text: string;
}

export interface ComposioFileMetadata {
  id: string;
  name: string;
  mimeType: string;
}

export interface ComposioCopyResult {
  newFileId: string;
  newFileName: string;
}

export interface ComposioShareResult {
  fileId: string;
  permissionId: string;
}

// ============================================================
// PARALLELIZATION HINTS
// ============================================================

/**
 * Tasks that can run in parallel after P1-T2:
 * - P1-T6 (migrate google-docs-actions.ts) — depends on this mapping
 * - P1-T7 (migrate google-drive.ts) — depends on this mapping
 */
export const BLOCKED_TASKS = ['P1-T6', 'P1-T7'] as const;

/**
 * Operations that require googleapis fallback (Composio gaps)
 */
export const REQUIRES_GOOGLEAPIS_FALLBACK = [
  'getDocumentPlaceholders',
  'extractPlaceholderDefinitionsFromText',
] as const;

/**
 * Operations fully covered by Composio (no googleapis needed)
 */
export const COMPOSIO_FULLY_COVERED = [
  'getDocumentContent',
  'getFileMetadata',
  'copyFile',
  'shareFile',
  'batchUpdateDocument', // primary, with edge case fallback
] as const;
