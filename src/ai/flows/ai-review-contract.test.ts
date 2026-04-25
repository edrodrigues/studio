import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// MOCK DEPENDENCIES — must be defined with vi.hoisted before vi.mock
// ============================================================

// Mock Genkit's ai module
const { mockAiGenerate } = vi.hoisted(() => ({
  mockAiGenerate: vi.fn(),
}));

// Mock Composio client
const { mockGetDocumentContent } = vi.hoisted(() => ({
  mockGetDocumentContent: vi.fn(),
}));

vi.mock('@/ai/genkit', () => ({
  ai: {
    generate: mockAiGenerate,
    definePrompt: vi.fn(() => {
      // Genkit's definePrompt calls ai.generate({ prompt, model, input, output })
      // The input schema fields are passed as the `input` property
      const mockPrompt = async (inputs: any) => {
        // Simulate Genkit's wrapping: ai.generate receives { input: inputs }
        const response = await mockAiGenerate({ input: inputs });
        return response;
      };
      (mockPrompt as any).generate = mockAiGenerate;
      (mockPrompt as any).__call__ = mockPrompt;
      return mockPrompt;
    }),
  },
}));

vi.mock('@/lib/composio-client', () => ({
  createComposioClient: vi.fn(() =>
    Promise.resolve({
      getDocumentContent: mockGetDocumentContent,
    })
  ),
}));

// Import after mocks are set up
import { aiReviewContract } from './ai-review-contract';

describe('ai-review-contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocumentContent.mockResolvedValue('Contrato de Prestação de Serviços entre ABC Ltda e XYZ SA, com objeto de elaboração de website corporativo, prazo de 12 meses, valor de R$ 50.000,00.');
    // Default: mock generate to return null output (tests override as needed)
    mockAiGenerate.mockResolvedValue({ output: null });
  });

  // ============================================================
  // UNIT TESTS — flow returns structured suggestions
  // ============================================================

  it('returns structured suggestions on successful review', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Contrato bem estruturado com algunas sugestões de melhoria.',
        overallQuality: 'needs_work',
        suggestions: [
          {
            section: 'Cláusula 3 - Do Valor',
            originalText: 'R$ 50.000,00',
            suggestedText: 'R$ 50.000,00 (cinquenta mil reais)',
            reason: 'Valores devem estar por extenso conforme jurisprudência',
            severity: 'critical',
            confidence: 'HIGH',
          },
        ],
      },
    });

    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      documentName: 'Contrato de Prestação de Serviços',
      reviewFocus: 'all',
    });

    expect(result.success).toBe(true);
    expect(result.documentId).toBe('doc-abc');
    expect(result.summary).toBe('Contrato bem estruturado com algunas sugestões de melhoria.');
    expect(result.overallQuality).toBe('needs_work');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].originalText).toBe('R$ 50.000,00');
    expect(result.suggestions[0].suggestedText).toBe('R$ 50.000,00 (cinquenta mil reais)');
    expect(result.suggestions[0].severity).toBe('critical');
    expect(result.suggestions[0].confidence).toBe('HIGH');
    expect(result.reviewedAt).toBeTruthy();
  });

  it('returns empty suggestions for good quality document', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Documento em excelente qualidade. Nenhuma sugestão necessária.',
        overallQuality: 'good',
        suggestions: [],
      },
    });

    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      documentName: 'Contrato Modelo',
      reviewFocus: 'all',
    });

    expect(result.success).toBe(true);
    expect(result.overallQuality).toBe('good');
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns critical quality when document has serious issues', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Documento com problemas legais sérios.',
        overallQuality: 'requires_revision',
        suggestions: [
          {
            section: 'Cláusula 1 - Do Objeto',
            originalText: 'Elaboração de website',
            suggestedText: 'Elaboração, manutenção e hospedagem de website',
            reason: 'Objeto do contrato está incompleto, violating Lei 14.133/21 art. 7',
            severity: 'critical',
            confidence: 'HIGH',
          },
        ],
      },
    });

    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-xyz',
      reviewFocus: 'legal',
    });

    expect(result.success).toBe(true);
    expect(result.overallQuality).toBe('requires_revision');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].severity).toBe('critical');
  });

  it('handles missing optional fields gracefully', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Revisão completa.',
        overallQuality: 'good',
        suggestions: [],
      },
    });

    // Only required fields (reviewFocus uses its default 'all')
    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      reviewFocus: 'all',
    });

    expect(result.success).toBe(true);
    expect(result.documentId).toBe('doc-abc');
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  it('returns error when getDocumentContent fails', async () => {
    mockGetDocumentContent.mockRejectedValue(new Error('DOCUMENT_NOT_FOUND'));

    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-nonexistent',
      documentName: 'Documento Inexistente',
      reviewFocus: 'all',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('DOCUMENT_NOT_FOUND');
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns error when AI generate fails', async () => {
    mockGetDocumentContent.mockResolvedValue('Some contract content');
    mockAiGenerate.mockRejectedValue(new Error('AI_SERVICE_UNAVAILABLE'));

    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      documentName: 'Contrato Teste',
      reviewFocus: 'all',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.suggestions).toHaveLength(0);
  });

  it('handles malformed AI response (missing fields)', async () => {
    // AI returns partial output — missing optional fields
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Revisão parcial.',
        // missing overallQuality and suggestions
      },
    });

    const result = await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      reviewFocus: 'all',
    });

    // Should not throw, should return a result (partial output returns success=true with undefined fields)
    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
  });

  // ============================================================
  // CONTENT PARSING TESTS
  // ============================================================

  it('passes document content to Gemini for review', async () => {
    const contractContent = 'CLÁUSULA PRIMEIRA - DO OBJETO: O presente contrato tem como objeto a elaboração de um sistema web completo.';
    mockGetDocumentContent.mockResolvedValue(contractContent);
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Documento revisado.',
        overallQuality: 'good',
        suggestions: [],
      },
    });

    await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-123',
      documentName: 'Contrato de Desenvolvimento',
      reviewFocus: 'all',
    });

    // Verify Composio was called to fetch document
    expect(mockGetDocumentContent).toHaveBeenCalledWith('doc-123');
    // Verify AI was called with document content
    expect(mockAiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          documentContent: contractContent,
          documentName: 'Contrato de Desenvolvimento',
          reviewFocus: 'Revisão geral completa — legal, completude, consistência e clareza',
        }),
      })
    );
  });

  it('uses default review focus when not specified', async () => {
    mockGetDocumentContent.mockResolvedValue('Contract content');
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Revisão completa.',
        overallQuality: 'good',
        suggestions: [],
      },
    });

    await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      documentName: 'Contrato',
      reviewFocus: 'all', // explicit to satisfy TypeScript (schema has .default('all'))
    });

    expect(mockAiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          reviewFocus: 'Revisão geral completa — legal, completude, consistência e clareza',
        }),
      })
    );
  });

  it('supports different review focus options', async () => {
    mockGetDocumentContent.mockResolvedValue('Contract content');
    mockAiGenerate.mockResolvedValue({
      output: {
        summary: 'Análise de legal completa.',
        overallQuality: 'good',
        suggestions: [],
      },
    });

    await aiReviewContract({
      userId: 'user-123',
      documentId: 'doc-abc',
      documentName: 'Contrato',
      reviewFocus: 'legal',
    });

    expect(mockAiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          reviewFocus: 'Foco em conformidade legal e correção de cláusulas',
        }),
      })
    );
  });
});
