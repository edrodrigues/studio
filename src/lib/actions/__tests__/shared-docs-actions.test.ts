import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/google-docs', () => ({
  extractPlaceholderDefinitionsFromText: vi.fn(),
}));

vi.mock('@/lib/template-source', () => ({
  getTemplateSourceFieldLabel: vi.fn((field: string) => {
    const labels: Record<string, string> = {
      googleDocLink: 'link original',
      projectDocLink: 'link customizado',
    };
    return labels[field] || field;
  }),
  isFallbackEligibleErrorType: vi.fn(() => true),
}));

import { extractPlaceholderDefinitionsFromText } from '@/lib/google-docs';
import {
  getErrorType,
  createTemplateActionError,
  buildValidationError,
  updateSourceFailure,
  getSourceAttemptOrder,
  cloneSourceDiagnostics,
  mergePlaceholderDefinitions,
  buildReplacementRequests,
  buildUserFriendlyError,
  type TemplateErrorType,
  type TemplateActionError,
  type TemplateSourceDiagnostics,
} from '../shared-docs-actions';

describe('shared-docs-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getErrorType', () => {
    it('returns the error type from an error object with errorType property', () => {
      const error = new Error('test') as TemplateActionError;
      error.errorType = 'PERMISSION_DENIED';
      expect(getErrorType(error)).toBe('PERMISSION_DENIED');
    });

    it('parses error type from error message', () => {
      const error = new Error('AUTH_EXPIRED: token expired');
      expect(getErrorType(error)).toBe('AUTH_EXPIRED');
    });

    it('returns UNKNOWN_ERROR for messages without known types', () => {
      expect(getErrorType(new Error('some random error'))).toBe('UNKNOWN_ERROR');
    });

    it('handles non-error inputs', () => {
      expect(getErrorType('just a string')).toBe('UNKNOWN_ERROR');
    });

    it('handles null/undefined', () => {
      expect(getErrorType(null)).toBe('UNKNOWN_ERROR');
      expect(getErrorType(undefined)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('createTemplateActionError', () => {
    it('creates an error with the correct type and details', () => {
      const error = createTemplateActionError('TEMPLATE_NOT_FOUND', 'document not found');
      expect(error).toBeInstanceOf(Error);
      expect(error.errorType).toBe('TEMPLATE_NOT_FOUND');
      expect(error.technicalDetails).toBe('document not found');
      expect(error.message).toBe('document not found');
    });

    it('attaches extra properties', () => {
      const error = createTemplateActionError('INVALID_REQUEST', 'bad input', {
        failedSource: 'googleDocLink',
      });
      expect(error.failedSource).toBe('googleDocLink');
    });
  });

  describe('buildValidationError', () => {
    it('creates INVALID_REQUEST error with source diagnostics', () => {
      const diagnostics = {
        googleDocLink: { field: 'googleDocLink' as const, label: 'link original', status: 'available' as const, link: '', fileId: null },
        projectDocLink: { field: 'projectDocLink' as const, label: 'link customizado', status: 'missing' as const, link: '', fileId: null },
      } as unknown as TemplateSourceDiagnostics;
      const error = buildValidationError('googleDocLink', diagnostics, 'invalid link');
      expect(error.errorType).toBe('INVALID_REQUEST');
      expect(error.failedSource).toBe('googleDocLink');
      expect(error.sourceDiagnostics).toBe(diagnostics);
    });
  });

  describe('updateSourceFailure', () => {
    it('updates the source diagnostic with error info', () => {
      const diagnostics = {
        googleDocLink: { field: 'googleDocLink', label: 'link original', status: 'available' as const, link: '', fileId: null },
        projectDocLink: { field: 'projectDocLink', label: 'link customizado', status: 'missing' as const, link: '', fileId: null },
      } as unknown as TemplateSourceDiagnostics;
      const error = new Error('PERMISSION_DENIED: forbidden');

      updateSourceFailure(diagnostics, 'googleDocLink', error);

      expect(diagnostics.googleDocLink.status).toBe('unavailable');
      expect(diagnostics.googleDocLink.errorType).toBe('PERMISSION_DENIED');
      expect(diagnostics.googleDocLink.message).toBe('PERMISSION_DENIED: forbidden');
    });
  });

  describe('getSourceAttemptOrder', () => {
    it('returns default order when no preferred source', () => {
      const diagnostics = {
        googleDocLink: { field: 'googleDocLink', label: 'link original', status: 'available' as const, link: '', fileId: 'abc' },
        projectDocLink: { field: 'projectDocLink', label: 'link customizado', status: 'available' as const, link: '', fileId: 'def' },
      } as unknown as TemplateSourceDiagnostics;
      expect(getSourceAttemptOrder(diagnostics)).toEqual(['googleDocLink', 'projectDocLink']);
    });

    it('prioritizes preferred source when available', () => {
      const diagnostics = {
        googleDocLink: { field: 'googleDocLink', label: 'link original', status: 'available' as const, link: '', fileId: 'abc' },
        projectDocLink: { field: 'projectDocLink', label: 'link customizado', status: 'available' as const, link: '', fileId: 'def' },
      } as unknown as TemplateSourceDiagnostics;
      expect(getSourceAttemptOrder(diagnostics, 'projectDocLink')).toEqual(['projectDocLink', 'googleDocLink']);
    });

    it('falls back to default order when preferred source is unavailable', () => {
      const diagnostics = {
        googleDocLink: { field: 'googleDocLink', label: 'link original', status: 'unavailable' as const, link: '', fileId: null },
        projectDocLink: { field: 'projectDocLink', label: 'link customizado', status: 'available' as const, link: '', fileId: 'def' },
      } as unknown as TemplateSourceDiagnostics;
      expect(getSourceAttemptOrder(diagnostics, 'googleDocLink')).toEqual(['googleDocLink', 'projectDocLink']);
    });
  });

  describe('cloneSourceDiagnostics', () => {
    it('creates a shallow copy of diagnostics', () => {
      const audit = {
        googleDocLink: { field: 'googleDocLink' as const, label: 'link original', status: 'available' as const, link: 'https://docs.google.com/document/d/abc/edit', fileId: 'abc' },
        projectDocLink: { field: 'projectDocLink' as const, label: 'link customizado', status: 'missing' as const, link: '', fileId: null },
        health: 'ready_original' as const,
      };
      const result = cloneSourceDiagnostics(audit);
      expect(result.googleDocLink.status).toBe('available');
      expect(result.projectDocLink.status).toBe('missing');
      // Should not mutate original
      audit.googleDocLink.status = 'unavailable' as any;
      expect(result.googleDocLink.status).toBe('available');
    });
  });

  describe('mergePlaceholderDefinitions', () => {
    it('merges duplicate placeholder definitions', () => {
      const mockExtract = vi.mocked(extractPlaceholderDefinitionsFromText);
      mockExtract.mockReturnValue([{ key: 'CLIENTE', matches: ['<<CLIENTE>>'] }]);

      const result = mergePlaceholderDefinitions(
        [{ key: 'CLIENTE', matches: ['{{CLIENTE}}'] }],
        'some fallback text'
      );

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('CLIENTE');
      expect(result[0].matches).toEqual(['<<CLIENTE>>', '{{CLIENTE}}']);
    });

    it('merges disjoint placeholder sets', () => {
      const mockExtract = vi.mocked(extractPlaceholderDefinitionsFromText);
      mockExtract.mockReturnValue([{ key: 'FORNECEDOR', matches: ['<<FORNECEDOR>>'] }]);

      const result = mergePlaceholderDefinitions(
        [{ key: 'CLIENTE', matches: ['<<CLIENTE>>'] }],
        'fallback'
      );

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('CLIENTE');
      expect(result[1].key).toBe('FORNECEDOR');
    });

    it('handles empty google doc placeholders', () => {
      const mockExtract = vi.mocked(extractPlaceholderDefinitionsFromText);
      mockExtract.mockReturnValue([]);

      const result = mergePlaceholderDefinitions([], 'fallback');
      expect(result).toHaveLength(0);
    });
  });

  describe('buildReplacementRequests', () => {
    it('builds requests for matched placeholders', () => {
      const requests = buildReplacementRequests(
        { CLIENTE: 'João Silva' },
        { CLIENTE: ['<<CLIENTE>>'] }
      );

      expect(requests.length).toBeGreaterThanOrEqual(1);
      const match = requests.find((r) => r.replaceAllText.containsText.text === '<<CLIENTE>>');
      expect(match).toBeDefined();
      expect(match!.replaceAllText.replaceText).toBe('João Silva');
    });

    it('skips empty replacements', () => {
      const requests = buildReplacementRequests(
        { CLIENTE: '   ' },
        { CLIENTE: ['<<CLIENTE>>'] }
      );

      expect(requests).toHaveLength(0);
    });

    it('generates standard placeholder formats', () => {
      const requests = buildReplacementRequests(
        { NOME: 'Maria' },
        {}
      );

      const formats = requests.map((r) => r.replaceAllText.containsText.text);
      expect(formats).toContain('<<NOME>>');
      expect(formats).toContain('{{NOME}}');
      expect(formats).toContain('[[NOME]]');
      expect(formats).toContain('<NOME>');
    });

    it('uses containsText not containingText', () => {
      const requests = buildReplacementRequests(
        { TEST: 'value' },
        { TEST: ['<<TEST>>'] }
      );

      requests.forEach((r) => {
        expect(r.replaceAllText).toHaveProperty('containsText');
        expect(r.replaceAllText).not.toHaveProperty('containingText');
      });
    });
  });

  describe('buildUserFriendlyError', () => {
    it('returns formatted error for AUTH_EXPIRED', () => {
      const error = createTemplateActionError('AUTH_EXPIRED', 'session expired', {
        sourceDiagnostics: {
          googleDocLink: { field: 'googleDocLink', label: 'link original', status: 'unavailable' as const, link: '', fileId: null },
          projectDocLink: { field: 'projectDocLink', label: 'link customizado', status: 'unavailable' as const, link: '', fileId: null },
        } as unknown as TemplateSourceDiagnostics,
      });

      const result = buildUserFriendlyError(error);
      expect(result.error).toContain('Sua sessão com o Google expirou');
      expect(result.errorType).toBe('AUTH_EXPIRED');
      expect(result.userInstructions.length).toBeGreaterThan(0);
    });

    it('handles unknown error types gracefully', () => {
      const result = buildUserFriendlyError(new Error('some random error'));
      expect(result.errorType).toBe('UNKNOWN_ERROR');
      expect(result.error).toContain('erro inesperado');
    });
  });
});
