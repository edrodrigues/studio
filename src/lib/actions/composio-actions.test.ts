import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  extractPlaceholderDefinitionsFromText,
} = vi.hoisted(() => ({
  extractPlaceholderDefinitionsFromText: vi.fn(),
}));

// Mock client returned by createComposioClient
const mockComposioClient = {
  checkConnection: vi.fn<(userId: string) => Promise<{ connected: boolean; status: string }>>(),
  getFileMetadata: vi.fn<(fileId: string) => Promise<{ id: string; name: string; mimeType: string }>>(),
  getDocumentContent: vi.fn<(documentId: string) => Promise<string>>(),
  getDocumentPlaceholders: vi.fn<(documentId: string) => Promise<Array<{ key: string; matches: string[] }>>>(),
  copyFile: vi.fn<(fileId: string, newName: string) => Promise<string>>(),
  batchUpdateDocument: vi.fn(),
};

vi.mock('@/lib/composio-client', () => ({
  createComposioClient: vi.fn(() => Promise.resolve(mockComposioClient)),
}));

vi.mock('@/lib/google-docs', () => ({
  extractPlaceholderDefinitionsFromText,
}));

vi.mock('@/ai/flows/ai-enrich-contract', () => ({
  aiEnrichContract: vi.fn(),
}));

import {
  inspectTemplateForGeneration,
  generateContractDoc,
} from './composio-actions';

describe('composio-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractPlaceholderDefinitionsFromText.mockReturnValue([]);
    mockComposioClient.checkConnection.mockResolvedValue({
      connected: true,
      status: 'ACTIVE',
    });
    mockComposioClient.getFileMetadata.mockImplementation(async (fileId: string) => ({
      id: fileId,
      name: 'Modelo Template',
      mimeType: 'application/vnd.google-apps.document',
    }));
    mockComposioClient.getDocumentPlaceholders.mockResolvedValue([
      { key: 'CLIENTE', matches: ['<<CLIENTE>>'] },
    ]);
    mockComposioClient.batchUpdateDocument.mockResolvedValue(undefined);
  });

  it('uses googleDocLink when the original template is available', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(async (fileId: string) => ({
      id: fileId,
      name: fileId === '1originalTemplateId123456' ? 'Modelo Base' : 'Modelo Projeto',
      mimeType: 'application/vnd.google-apps.document',
    }));
    mockComposioClient.getDocumentContent.mockResolvedValue(
      '合同内容 for <<CLIENTE>>'
    );

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.resolvedSource).toBe('googleDocLink');
    expect(result.fallbackUsed).toBe(false);
    expect(result.fileId).toBe('1originalTemplateId123456');
  });

  it('falls back to projectDocLink when the original template is missing', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(
      async (fileId: string) => {
        if (fileId === '1originalTemplateId123456') {
          const error = new Error('TEMPLATE_NOT_FOUND: missing');
          (error as any).errorType = 'TEMPLATE_NOT_FOUND';
          throw error;
        }
        return {
          id: fileId,
          name: 'Modelo Projeto',
          mimeType: 'application/vnd.google-apps.document',
        };
      }
    );
    mockComposioClient.getDocumentContent.mockResolvedValue(
      '合同内容 for <<CLIENTE>>'
    );

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.resolvedSource).toBe('projectDocLink');
    expect(result.fallbackUsed).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('versão customizada do projeto'),
      ])
    );
  });

  it('falls back to projectDocLink when the original template has permission issues', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(
      async (fileId: string) => {
        if (fileId === '1originalTemplateId123456') {
          const error = new Error('PERMISSION_DENIED: forbidden');
          (error as any).errorType = 'PERMISSION_DENIED';
          throw error;
        }
        return {
          id: fileId,
          name: 'Modelo Projeto',
          mimeType: 'application/vnd.google-apps.document',
        };
      }
    );
    mockComposioClient.getDocumentContent.mockResolvedValue(
      '合同内容 for <<CLIENTE>>'
    );

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.resolvedSource).toBe('projectDocLink');
    expect(result.fallbackUsed).toBe(true);
  });

  it('fails without fallback when the original link format is invalid', async () => {
    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://example.com/not-a-google-doc',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failure');
    }
    const failedResult = result as typeof result & {
      success: false;
      errorType: string;
    };
    expect(failedResult.errorType).toBe('INVALID_REQUEST');
    expect(mockComposioClient.getFileMetadata).not.toHaveBeenCalled();
  });

  it('uses the same fallback source during generation and fills the copied custom template through Composio', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(
      async (fileId: string) => {
        if (fileId === '1originalTemplateId123456') {
          const error = new Error('TEMPLATE_NOT_FOUND: missing');
          (error as any).errorType = 'TEMPLATE_NOT_FOUND';
          throw error;
        }
        return {
          id: fileId,
          name: 'Modelo Projeto',
          mimeType: 'application/vnd.google-apps.document',
        };
      }
    );
    mockComposioClient.getDocumentContent.mockResolvedValue(
      '合同内容 for <<CLIENTE>>'
    );
    mockComposioClient.copyFile.mockResolvedValue(
      '1newDocumentId123456'
    );

    const inspection = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(inspection.success).toBe(true);
    if (!inspection.success) {
      throw new Error('expected inspection success');
    }

    const result = await generateContractDoc('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
      preferredSource: inspection.resolvedSource,
      clientName: 'Cliente Exemplo',
      confirmedPlaceholders: { CLIENTE: 'Cliente Exemplo' },
      placeholderMatches: { CLIENTE: ['<<CLIENTE>>'] },
      projectId: 'project-1',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected generation success');
    }
    expect(result.resolvedSource).toBe('projectDocLink');
    expect(result.fallbackUsed).toBe(true);
    expect(mockComposioClient.copyFile).toHaveBeenCalledWith(
      '1projectTemplateId123456',
      expect.stringContaining('Modelo TED')
    );
    expect(mockComposioClient.batchUpdateDocument).toHaveBeenCalledWith(
      '1newDocumentId123456',
      expect.arrayContaining([
        expect.objectContaining({
          replaceAllText: expect.objectContaining({
            replaceText: 'Cliente Exemplo',
            containsText: expect.objectContaining({ text: '<<CLIENTE>>' }),
          }),
        }),
      ])
    );
    expect(result.documentLink).toBe(
      'https://docs.google.com/document/d/1newDocumentId123456/edit'
    );
  });

  it('fails when both original and custom links are inaccessible', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(async () => {
      throw new Error('PERMISSION_DENIED: forbidden');
    });

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failure');
    }
    const failedResult = result as typeof result & {
      success: false;
      errorType: string;
    };
    expect(failedResult.errorType).toBe('PERMISSION_DENIED');
  });

  it('falls back to projectDocLink when the original template has wrong MIME type', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(
      async (fileId: string) => {
        if (fileId === '1originalTemplateId123456') {
          const error = new Error('INVALID_TEMPLATE_TYPE: wrong MIME type');
          (error as any).errorType = 'INVALID_TEMPLATE_TYPE';
          throw error;
        }
        return {
          id: fileId,
          name: 'Modelo Projeto',
          mimeType: 'application/vnd.google-apps.document',
        };
      }
    );
    mockComposioClient.getDocumentContent.mockResolvedValue(
      '合同内容 for <<CLIENTE>>'
    );

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.resolvedSource).toBe('projectDocLink');
    expect(result.fallbackUsed).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('versão customizada do projeto'),
      ])
    );
  });

  it('fails when both original has wrong MIME type and custom is inaccessible', async () => {
    mockComposioClient.getFileMetadata.mockImplementation(
      async (fileId: string) => {
        if (fileId === '1originalTemplateId123456') {
          return {
            id: '1originalTemplateId123456',
            name: 'Modelo Base (PDF)',
            mimeType: 'application/pdf',
          };
        }
        throw new Error('PERMISSION_DENIED: forbidden');
      }
    );

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failure');
    }
  });

  it('throws AUTH_EXPIRED when Composio connection is not active', async () => {
    mockComposioClient.checkConnection.mockResolvedValue({
      connected: false,
      status: 'INACTIVE',
    });

    const result = await inspectTemplateForGeneration('user-123', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink:
        'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink:
        'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failure');
    }
    const failedResult = result as typeof result & {
      success: false;
      errorType: string;
    };
    expect(failedResult.errorType).toBe('AUTH_EXPIRED');
  });
});
