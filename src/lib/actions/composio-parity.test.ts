/**
 * P1-T11: Parity Verification — Composio vs googleapis Output
 *
 * Compares output from `composio-actions.ts` (Composio SDK path) vs
 * `google-docs-actions.ts` (legacy googleapis path) to ensure identical
 * behavior for same inputs.
 *
 * Key parity dimensions verified:
 * 1. Return type structure (success/failure)
 * 2. Error types mapped correctly
 * 3. Portuguese error messages identical
 * 4. Fallback logic behaves identically
 * 5. Resolved source structure matches
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCKS — shared between both action file imports
// =============================================================================

// Composio client mock (used by composio-actions.ts)
const mockComposioClient = {
  checkConnection: vi.fn<(userId: string) => Promise<{ connected: boolean; status: string }>>(),
  getFileMetadata: vi.fn<(fileId: string) => Promise<{ id: string; name: string; mimeType: string }>>(),
  getDocumentContent: vi.fn<(documentId: string) => Promise<string>>(),
  copyFile: vi.fn<(fileId: string, newName: string) => Promise<string>>(),
  batchUpdateDocument: vi.fn(),
};

vi.mock('@/lib/composio-client', () => ({
  createComposioClient: vi.fn(() => Promise.resolve(mockComposioClient)),
}));

// google-docs mock (shared by both)
vi.mock('@/lib/google-docs', () => ({
  getDocumentPlaceholders: vi.fn().mockResolvedValue([
    { key: 'CLIENT_NAME', matches: ['{{CLIENT_NAME}}'] },
    { key: 'CONTRACT_DATE', matches: ['{{CONTRACT_DATE}}'] },
  ]),
  extractPlaceholderDefinitionsFromText: vi.fn().mockReturnValue([]),
}));

// google-drive mock (used by both implementations)
const mockGoogleDriveGetFileMetadata = vi.fn<(userId: string, fileId: string) => Promise<{ id: string; name: string; mimeType: string }>>();
const mockGoogleDriveCopyFile = vi.fn<(userId: string, fileId: string, newName: string) => Promise<string>>();

vi.mock('@/lib/google-drive', () => ({
  getFileMetadata: mockGoogleDriveGetFileMetadata,
  copyFile: mockGoogleDriveCopyFile,
}));

// generate-contract-in-docs mock
vi.mock('@/ai/flows/generate-contract-in-docs', () => ({
  generateContractInDocs: vi.fn().mockResolvedValue({ replacementsApplied: 3 }),
}));

// =============================================================================
// TEST INPUT — shared test data
// =============================================================================

const USER_ID = 'user-123';
const TEMPLATE_ID = 'template-1';
const TEMPLATE_NAME = 'Modelo TED';

const validGoogleDocLink = 'https://docs.google.com/document/d/1originalTemplateId123456/edit';
const validProjectDocLink = 'https://docs.google.com/document/d/1projectTemplateId123456/edit';

const baseInput = {
  templateId: TEMPLATE_ID,
  templateName: TEMPLATE_NAME,
  googleDocLink: validGoogleDocLink,
  projectDocLink: validProjectDocLink,
};

const metadataOriginal = {
  id: '1originalTemplateId123456',
  name: 'Modelo TED',
  mimeType: 'application/vnd.google-apps.document',
};

const metadataProject = {
  id: '1projectTemplateId123456',
  name: 'Modelo TED Customizado',
  mimeType: 'application/vnd.google-apps.document',
};

// =============================================================================
// PARITY TESTS
// =============================================================================

describe('P1-T11: Composio vs googleapis Parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: both files connected
    mockComposioClient.checkConnection.mockResolvedValue({ connected: true, status: 'ACTIVE' });
  });

  // ---------------------------------------------------------------------------
  // DIMENSION 1: Return type structure parity
  // Both functions return { success: true, ... } or { success: false, error: string }
  // ---------------------------------------------------------------------------
  describe('Return type structure parity', () => {
    it('composio-actions: returns correct success shape', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');

      mockGoogleDriveGetFileMetadata.mockResolvedValue(metadataOriginal);

      const result = await composioInspect(USER_ID, baseInput);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('fileId');
      expect(result).toHaveProperty('templateName');
      expect(result).toHaveProperty('placeholders');
      expect(result).toHaveProperty('resolvedSource');
      expect(result).toHaveProperty('fallbackUsed');
      expect(result).toHaveProperty('sourceDiagnostics');
      expect(result).toHaveProperty('warnings');
    });

    it('google-docs-actions: returns correct success shape', async () => {
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      mockGoogleDriveGetFileMetadata.mockResolvedValue(metadataOriginal);

      const result = await googleDocsInspect(USER_ID, baseInput);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('fileId');
      expect(result).toHaveProperty('templateName');
      expect(result).toHaveProperty('placeholders');
      expect(result).toHaveProperty('resolvedSource');
      expect(result).toHaveProperty('fallbackUsed');
      expect(result).toHaveProperty('sourceDiagnostics');
      expect(result).toHaveProperty('warnings');
    });

    it('Both implementations: identical success response keys', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      mockGoogleDriveGetFileMetadata.mockResolvedValue(metadataOriginal);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      const composioKeys = Object.keys(composioResult).sort();
      const googleDocsKeys = Object.keys(googleDocsResult).sort();

      expect(composioKeys).toEqual(googleDocsKeys);
    });
  });

  // ---------------------------------------------------------------------------
  // DIMENSION 2: Error type parity — same input error → same errorType
  // ---------------------------------------------------------------------------
  describe('Error type parity', () => {
    it('TEMPLATE_NOT_FOUND: both return errorType TEMPLATE_NOT_FOUND', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      // Simulate file not found
      const error = new Error('TEMPLATE_NOT_FOUND: file not found');
      (error as any).errorType = 'TEMPLATE_NOT_FOUND';
      mockGoogleDriveGetFileMetadata.mockRejectedValue(error);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(false);
      expect(googleDocsResult.success).toBe(false);
      expect(composioResult.errorType).toEqual(googleDocsResult.errorType);
    });

    it('PERMISSION_DENIED: both return errorType PERMISSION_DENIED', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      const error = new Error('PERMISSION_DENIED: forbidden');
      (error as any).errorType = 'PERMISSION_DENIED';
      mockGoogleDriveGetFileMetadata.mockRejectedValue(error);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(false);
      expect(googleDocsResult.success).toBe(false);
      expect(composioResult.errorType).toEqual(googleDocsResult.errorType);
      expect(composioResult.errorType).toBe('PERMISSION_DENIED');
    });

    it('INVALID_TEMPLATE_TYPE: both return errorType INVALID_TEMPLATE_TYPE', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      // Return PDF instead of Google Doc
      mockGoogleDriveGetFileMetadata.mockResolvedValue({
        id: '1originalTemplateId123456',
        name: 'Modelo Base (PDF)',
        mimeType: 'application/pdf',
      });

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(false);
      expect(googleDocsResult.success).toBe(false);
      expect(composioResult.errorType).toEqual(googleDocsResult.errorType);
      expect(composioResult.errorType).toBe('INVALID_TEMPLATE_TYPE');
    });

    it('INVALID_REQUEST (bad link format): both return errorType INVALID_REQUEST', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      const badInput = {
        ...baseInput,
        googleDocLink: 'https://example.com/not-a-google-doc',
      };

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, badInput),
        googleDocsInspect(USER_ID, badInput),
      ]);

      expect(composioResult.success).toBe(false);
      expect(googleDocsResult.success).toBe(false);
      expect(composioResult.errorType).toBe('INVALID_REQUEST');
      expect(googleDocsResult.errorType).toBe('INVALID_REQUEST');
    });
  });

  // ---------------------------------------------------------------------------
  // DIMENSION 3: Portuguese error message parity
  // ---------------------------------------------------------------------------
  describe('Portuguese error message parity', () => {
    it('TEMPLATE_NOT_FOUND: same Portuguese user message', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      const error = new Error('TEMPLATE_NOT_FOUND: file not found');
      (error as any).errorType = 'TEMPLATE_NOT_FOUND';
      mockGoogleDriveGetFileMetadata.mockRejectedValue(error);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      // Key parity assertion: messages are identical
      expect(composioResult.error).toEqual(googleDocsResult.error);
      expect(composioResult.errorType).toBe('TEMPLATE_NOT_FOUND');
    });

    it('PERMISSION_DENIED: same Portuguese user message', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      const error = new Error('PERMISSION_DENIED: forbidden');
      (error as any).errorType = 'PERMISSION_DENIED';
      mockGoogleDriveGetFileMetadata.mockRejectedValue(error);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      // Key parity assertion: messages are identical
      expect(composioResult.error).toEqual(googleDocsResult.error);
      expect(composioResult.errorType).toBe('PERMISSION_DENIED');
    });

    it('INVALID_TEMPLATE_TYPE: same Portuguese user message', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      mockGoogleDriveGetFileMetadata.mockResolvedValue({
        id: '1originalTemplateId123456',
        name: 'Modelo Base (PDF)',
        mimeType: 'application/pdf',
      });

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      // Key parity assertion: messages are identical
      expect(composioResult.error).toEqual(googleDocsResult.error);
      expect(composioResult.errorType).toBe('INVALID_TEMPLATE_TYPE');
    });

    it('INVALID_REQUEST: same Portuguese user message for bad link', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      const badInput = {
        ...baseInput,
        googleDocLink: 'https://example.com/not-a-google-doc',
      };

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, badInput),
        googleDocsInspect(USER_ID, badInput),
      ]);

      // Key parity assertion: messages are identical
      expect(composioResult.error).toEqual(googleDocsResult.error);
      expect(composioResult.errorType).toBe('INVALID_REQUEST');
    });

  });

  // ---------------------------------------------------------------------------
  // DIMENSION 4: Fallback logic parity
  // When original template fails with fallback-eligible error, use projectDocLink
  // ---------------------------------------------------------------------------
  describe('Fallback logic parity', () => {
    it('TEMPLATE_NOT_FOUND on original → falls back to projectDocLink in both', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      // Original fails with TEMPLATE_NOT_FOUND (fallback-eligible)
      let callCount = 0;
      mockGoogleDriveGetFileMetadata.mockImplementation(async (userId: string, fileId: string) => {
        callCount++;
        if (fileId === '1originalTemplateId123456') {
          const error = new Error('TEMPLATE_NOT_FOUND: file not found');
          (error as any).errorType = 'TEMPLATE_NOT_FOUND';
          throw error;
        }
        return metadataProject;
      });

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      // Both should succeed using fallback
      expect(composioResult.success).toBe(true);
      expect(googleDocsResult.success).toBe(true);
      expect(composioResult.resolvedSource).toBe('projectDocLink');
      expect(googleDocsResult.resolvedSource).toBe('projectDocLink');
      expect(composioResult.fallbackUsed).toBe(true);
      expect(googleDocsResult.fallbackUsed).toBe(true);
      // Same resolved fileId (project doc)
      expect(composioResult.fileId).toEqual(googleDocsResult.fileId);
    });

    it('PERMISSION_DENIED on original → falls back to projectDocLink in both', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      let callCount = 0;
      mockGoogleDriveGetFileMetadata.mockImplementation(async (userId: string, fileId: string) => {
        callCount++;
        if (fileId === '1originalTemplateId123456') {
          const error = new Error('PERMISSION_DENIED: forbidden');
          (error as any).errorType = 'PERMISSION_DENIED';
          throw error;
        }
        return metadataProject;
      });

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(true);
      expect(googleDocsResult.success).toBe(true);
      expect(composioResult.resolvedSource).toBe('projectDocLink');
      expect(googleDocsResult.resolvedSource).toBe('projectDocLink');
      expect(composioResult.fallbackUsed).toBe(true);
      expect(googleDocsResult.fallbackUsed).toBe(true);
    });

    it('INVALID_TEMPLATE_TYPE on original → falls back to projectDocLink in both', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      let callCount = 0;
      mockGoogleDriveGetFileMetadata.mockImplementation(async (userId: string, fileId: string) => {
        callCount++;
        if (fileId === '1originalTemplateId123456') {
          return {
            id: '1originalTemplateId123456',
            name: 'Modelo PDF',
            mimeType: 'application/pdf',
          };
        }
        return metadataProject;
      });

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(true);
      expect(googleDocsResult.success).toBe(true);
      expect(composioResult.resolvedSource).toBe('projectDocLink');
      expect(googleDocsResult.resolvedSource).toBe('projectDocLink');
      expect(composioResult.fallbackUsed).toBe(true);
      expect(googleDocsResult.fallbackUsed).toBe(true);
    });

    it('Both unavailable → returns same error type and sourceDiagnostics structure', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      // Both links fail with PERMISSION_DENIED
      const error = new Error('PERMISSION_DENIED: forbidden');
      (error as any).errorType = 'PERMISSION_DENIED';
      mockGoogleDriveGetFileMetadata.mockRejectedValue(error);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(false);
      expect(googleDocsResult.success).toBe(false);
      expect(composioResult.errorType).toBe('PERMISSION_DENIED');
      expect(googleDocsResult.errorType).toBe('PERMISSION_DENIED');

      // sourceDiagnostics keys should match
      const composioDiagKeys = Object.keys(composioResult.sourceDiagnostics || {}).sort();
      const googleDocsDiagKeys = Object.keys(googleDocsResult.sourceDiagnostics || {}).sort();
      expect(composioDiagKeys).toEqual(googleDocsDiagKeys);
    });
  });

  // ---------------------------------------------------------------------------
  // DIMENSION 5: Resolved source structure parity
  // ---------------------------------------------------------------------------
  describe('Resolved source structure parity', () => {
    it('Both resolve to googleDocLink when available', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      mockGoogleDriveGetFileMetadata.mockResolvedValue(metadataOriginal);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      expect(composioResult.success).toBe(true);
      expect(googleDocsResult.success).toBe(true);
      expect(composioResult.resolvedSource).toBe('googleDocLink');
      expect(googleDocsResult.resolvedSource).toBe('googleDocLink');
      expect(composioResult.fallbackUsed).toBe(false);
      expect(googleDocsResult.fallbackUsed).toBe(false);
      expect(composioResult.fileId).toEqual(googleDocsResult.fileId);
    });

    it('Both include identical sourceDiagnostics for googleDocLink', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');
      const { inspectTemplateForGeneration: googleDocsInspect } = await import('./google-docs-actions');

      mockGoogleDriveGetFileMetadata.mockResolvedValue(metadataOriginal);

      const [composioResult, googleDocsResult] = await Promise.all([
        composioInspect(USER_ID, baseInput),
        googleDocsInspect(USER_ID, baseInput),
      ]);

      const composioDiag = composioResult.sourceDiagnostics?.googleDocLink;
      const googleDocsDiag = googleDocsResult.sourceDiagnostics?.googleDocLink;

      expect(composioDiag?.fileId).toEqual(googleDocsDiag?.fileId);
      expect(composioDiag?.mimeType).toEqual(googleDocsDiag?.mimeType);
      expect(composioDiag?.status).toEqual(googleDocsDiag?.status);
    });
  });

  // ---------------------------------------------------------------------------
  // DIMENSION 6: Composio-specific behavior — connection check
  // google-docs-actions does NOT have this (uses accessToken directly)
  // composio-actions throws AUTH_EXPIRED when not connected
  // ---------------------------------------------------------------------------
  describe('Composio connection check (additive behavior)', () => {
    it('composio-actions: throws AUTH_EXPIRED when not connected', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');

      // Simulate disconnected account - checkConnection returns { connected: false }
      // which triggers requireComposioConnection to throw AUTH_EXPIRED
      mockComposioClient.checkConnection.mockResolvedValue({ connected: false, status: 'EXPIRED' });

      const result = await composioInspect(USER_ID, baseInput);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('AUTH_EXPIRED');
      // Message is from buildUserFriendlyError's AUTH_EXPIRED case: "Sua sessão com o Google expirou."
      expect(result.error).toEqual('Sua sessão com o Google expirou.');
    });

    it('composio-actions: succeeds when connected', async () => {
      const { inspectTemplateForGeneration: composioInspect } = await import('./composio-actions');

      mockComposioClient.checkConnection.mockResolvedValue({ connected: true, status: 'ACTIVE' });
      mockGoogleDriveGetFileMetadata.mockResolvedValue(metadataOriginal);

      const result = await composioInspect(USER_ID, baseInput);

      expect(result.success).toBe(true);
    });
  });
});
