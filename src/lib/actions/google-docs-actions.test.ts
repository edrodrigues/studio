import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getFileMetadata,
  copyFile,
  getDocumentPlaceholders,
  extractPlaceholderDefinitionsFromText,
  generateContractInDocs,
} = vi.hoisted(() => ({
  getFileMetadata: vi.fn(),
  copyFile: vi.fn(),
  getDocumentPlaceholders: vi.fn(),
  extractPlaceholderDefinitionsFromText: vi.fn(),
  generateContractInDocs: vi.fn(),
}));

vi.mock('@/lib/google-drive', () => ({
  getFileMetadata,
  copyFile,
}));

vi.mock('@/lib/google-docs', () => ({
  getDocumentPlaceholders,
  extractPlaceholderDefinitionsFromText,
}));

vi.mock('@/ai/flows/generate-contract-in-docs', () => ({
  generateContractInDocs,
}));

import {
  generateContractDoc,
  inspectTemplateForGeneration,
} from './google-docs-actions';

describe('google-docs-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractPlaceholderDefinitionsFromText.mockReturnValue([]);
  });

  it('uses googleDocLink when the original template is available', async () => {
    getFileMetadata.mockResolvedValue({
      id: '1originalTemplateId123456',
      name: 'Modelo Base',
      mimeType: 'application/vnd.google-apps.document',
    });
    getDocumentPlaceholders.mockResolvedValue([
      { key: 'CLIENTE', matches: ['<<CLIENTE>>'] },
    ]);

    const result = await inspectTemplateForGeneration('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
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
    getFileMetadata.mockImplementation(async (_token, fileId: string) => {
      if (fileId === '1originalTemplateId123456') {
        throw new Error('TEMPLATE_NOT_FOUND: missing');
      }

      return {
        id: '1projectTemplateId123456',
        name: 'Modelo Projeto',
        mimeType: 'application/vnd.google-apps.document',
      };
    });
    getDocumentPlaceholders.mockResolvedValue([
      { key: 'CLIENTE', matches: ['<<CLIENTE>>'] },
    ]);

    const result = await inspectTemplateForGeneration('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
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
    getFileMetadata.mockImplementation(async (_token, fileId: string) => {
      if (fileId === '1originalTemplateId123456') {
        throw new Error('PERMISSION_DENIED: forbidden');
      }

      return {
        id: '1projectTemplateId123456',
        name: 'Modelo Projeto',
        mimeType: 'application/vnd.google-apps.document',
      };
    });
    getDocumentPlaceholders.mockResolvedValue([
      { key: 'CLIENTE', matches: ['<<CLIENTE>>'] },
    ]);

    const result = await inspectTemplateForGeneration('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.resolvedSource).toBe('projectDocLink');
    expect(result.fallbackUsed).toBe(true);
  });

  it('fails without fallback when the original link format is invalid', async () => {
    const result = await inspectTemplateForGeneration('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://example.com/not-a-google-doc',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failure');
    }
    const failedResult = result as typeof result & { success: false; errorType: string };
    expect(failedResult.errorType).toBe('INVALID_REQUEST');
    expect(getFileMetadata).not.toHaveBeenCalled();
  });

  it('uses the same fallback source during generation and copies the custom template', async () => {
    getFileMetadata.mockImplementation(async (_token, fileId: string) => {
      if (fileId === '1originalTemplateId123456') {
        throw new Error('TEMPLATE_NOT_FOUND: missing');
      }

      return {
        id: '1projectTemplateId123456',
        name: 'Modelo Projeto',
        mimeType: 'application/vnd.google-apps.document',
      };
    });
    getDocumentPlaceholders.mockResolvedValue([
      { key: 'CLIENTE', matches: ['<<CLIENTE>>'] },
    ]);
    copyFile.mockResolvedValue('1newDocumentId123456');
    generateContractInDocs.mockResolvedValue({
      documentLink: 'https://docs.google.com/document/d/1newDocumentId123456/edit',
      replacementsApplied: 3,
    });

    const inspection = await inspectTemplateForGeneration('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(inspection.success).toBe(true);
    if (!inspection.success) {
      throw new Error('expected inspection success');
    }

    const result = await generateContractDoc('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
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
    expect(copyFile).toHaveBeenCalledWith(
      'token',
      '1projectTemplateId123456',
      expect.stringContaining('Modelo TED')
    );
  });

  it('fails when both original and custom links are inaccessible', async () => {
    getFileMetadata.mockImplementation(async () => {
      throw new Error('PERMISSION_DENIED: forbidden');
    });

    const result = await inspectTemplateForGeneration('token', {
      templateId: 'template-1',
      templateName: 'Modelo TED',
      googleDocLink: 'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      projectDocLink: 'https://docs.google.com/document/d/1projectTemplateId123456/edit',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failure');
    }
    const failedResult = result as typeof result & { success: false; errorType: string };
    expect(failedResult.errorType).toBe('PERMISSION_DENIED');
  });
});
