import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// MOCK DEPENDENCIES — must be defined with vi.hoisted before vi.mock
// ============================================================

// Mock Genkit's ai module — mock generate directly since definePrompt
// delegates to it internally
const { mockAiGenerate } = vi.hoisted(() => ({
  mockAiGenerate: vi.fn(),
}));

// Mock Composio client
const { mockBatchUpdateDocument } = vi.hoisted(() => ({
  mockBatchUpdateDocument: vi.fn(),
}));

vi.mock('@/ai/genkit', () => ({
  ai: {
    generate: mockAiGenerate,
    // In Genkit 1.x, definePrompt returns a Prompt object that wraps generate.
    // The Prompt object is callable (has __call__) which internally calls generate.
    // We need the returned "prompt" to be callable AND return output via generate.
    definePrompt: vi.fn(() => {
      // This returned object is what the flow code calls as enrichContractPrompt(...)
      // It needs to be callable and return a response object with output
      const mockPrompt = async (inputs: any) => {
        // When the prompt is called, it internally calls ai.generate
        // Our mock ai.generate returns the output directly
        const response = await mockAiGenerate(inputs);
        return response;
      };
      // Also attach generate and __call__ to match Genkit Prompt interface
      (mockPrompt as any).generate = mockAiGenerate;
      (mockPrompt as any).__call__ = mockPrompt;
      return mockPrompt;
    }),
  },
}));

vi.mock('@/lib/composio-client', () => ({
  createComposioClient: vi.fn(() =>
    Promise.resolve({
      batchUpdateDocument: mockBatchUpdateDocument,
    })
  ),
}));

// Import after mocks are set up
import { aiEnrichContract } from './ai-enrich-contract';

describe('ai-enrich-contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchUpdateDocument.mockResolvedValue(undefined);
    // Default: mock generate to return null output (tests override as needed)
    mockAiGenerate.mockResolvedValue({ output: null });
  });

  // ============================================================
  // TEST: Full entity data → all placeholders filled
  // ============================================================
  it('fills all placeholders when entity data is complete', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        substitutions: [
          { placeholder: 'CLIENTE', value: 'Universidade Federal do Rio de Janeiro', confidence: 'HIGH' },
          { placeholder: 'VALOR_TOTAL', value: 'R$ 150.000,00', confidence: 'HIGH' },
          { placeholder: 'DATA_ASSINATURA', value: '15/01/2025', confidence: 'HIGH' },
        ],
        reasoning: 'All values found in entity data',
      },
    });

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE', 'VALOR_TOTAL', 'DATA_ASSINATURA'],
      entityData: {
        CLIENTE: 'Universidade Federal do Rio de Janeiro',
        VALOR_TOTAL: 'R$ 150.000,00',
        DATA_ASSINATURA: '15/01/2025',
      },
      context: 'Contrato de prestação de serviços de limpeza',
      contractType: 'Contrato de Prestação de Serviços',
    });

    expect(result.success).toBe(true);
    expect(result.substitutions).toHaveLength(3);
    expect(result.unfilled).toHaveLength(0);
    expect(result.substitutions.map(s => s.placeholder).sort()).toEqual(
      ['CLIENTE', 'VALOR_TOTAL', 'DATA_ASSINATURA'].sort()
    );
  });

  // ============================================================
  // TEST: Partial data → some placeholders marked as [DADO NÃO ENCONTRADO]
  // ============================================================
  it('marks unfound placeholders as [DADO NÃO ENCONTRADO]', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        substitutions: [
          { placeholder: 'CLIENTE', value: 'Universidade Federal do Rio de Janeiro', confidence: 'HIGH' },
          { placeholder: 'VALOR_TOTAL', value: '[DADO NÃO ENCONTRADO]', confidence: 'LOW' },
        ],
        reasoning: 'Only CLIENTE was found in entity data',
      },
    });

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE', 'VALOR_TOTAL', 'CNPJ'],
      entityData: {
        CLIENTE: 'Universidade Federal do Rio de Janeiro',
      },
      context: 'Contrato de prestação de serviços',
      contractType: 'Contrato de Prestação de Serviços',
    });

    expect(result.success).toBe(true);
    expect(result.substitutions).toHaveLength(1);
    expect(result.unfilled).toHaveLength(2); // VALOR_TOTAL and CNPJ
    expect(result.unfilled).toContain('VALOR_TOTAL');
    expect(result.unfilled).toContain('CNPJ');
  });

  // ============================================================
  // TEST: AI failure → graceful error return
  // ============================================================
  it('returns error result when AI generate throws', async () => {
    mockAiGenerate.mockRejectedValue(new Error('Model invocation failed'));

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE', 'VALOR_TOTAL'],
      entityData: { CLIENTE: 'Test Corp' },
      context: 'Test context',
      contractType: 'TED',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Erro na inferência de IA');
    expect(result.unfilled).toHaveLength(2); // all placeholders unfilled
  });

  // ============================================================
  // TEST: Composio batch update fails → graceful fallback
  // ============================================================
  it('returns substitutions without blocking when Composio batch update fails', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        substitutions: [
          { placeholder: 'CLIENTE', value: 'Universidade Federal do Rio de Janeiro', confidence: 'HIGH' },
        ],
        reasoning: 'Found in entity data',
      },
    });

    mockBatchUpdateDocument.mockRejectedValue(new Error('PERMISSION_DENIED: forbidden'));

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE'],
      entityData: { CLIENTE: 'Universidade Federal do Rio de Janeiro' },
      context: 'Contrato de prestação de serviços',
      contractType: 'Contrato de Prestação de Serviços',
    });

    // Even though Composio fails, we get back what we would have applied
    expect(result.success).toBe(false);
    expect(result.error).toContain('Erro ao aplicar substituições');
    expect(result.substitutions).toHaveLength(1);
    expect(result.substitutions[0].placeholder).toBe('CLIENTE');
    expect(result.substitutions[0].value).toBe('Universidade Federal do Rio de Janeiro');
  });

  // ============================================================
  // TEST: Source tracking — entity vs context
  // ============================================================
  it('marks substitutions as entity-sourced when value comes from entity data', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        substitutions: [
          { placeholder: 'CLIENTE', value: 'Universidade Federal do Rio de Janeiro', confidence: 'HIGH' },
        ],
        reasoning: 'Matched from entity data',
      },
    });

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE'],
      entityData: { CLIENTE: 'Universidade Federal do Rio de Janeiro' },
      context: 'Contrato de prestação de serviços',
      contractType: 'Contrato de Prestação de Serviços',
    });

    expect(result.success).toBe(true);
    expect(result.substitutions[0].source).toBe('entity');
    expect(result.substitutions[0].confidence).toBe('HIGH');
  });

  // ============================================================
  // TEST: Invalid AI response → error handling
  // ============================================================
  it('handles malformed AI response gracefully', async () => {
    mockAiGenerate.mockResolvedValue({
      output: null, // invalid response
    });

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE'],
      entityData: { CLIENTE: 'Test Corp' },
      context: 'Test',
      contractType: 'TED',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Resposta inválida do modelo de IA');
  });

  // ============================================================
  // TEST: Placeholder name matching (with/without brackets)
  // ============================================================
  it('matches placeholder names with various bracket styles', async () => {
    mockAiGenerate.mockResolvedValue({
      output: {
        substitutions: [
          { placeholder: 'CLIENTE', value: 'Universidade Federal do Rio de Janeiro', confidence: 'HIGH' },
          { placeholder: '<<VALOR_TOTAL>>', value: 'R$ 100.000,00', confidence: 'HIGH' },
          { placeholder: 'DATA.DE.INICIO', value: '01/03/2025', confidence: 'MEDIUM' },
        ],
        reasoning: 'Matched all placeholder variants',
      },
    });

    const result = await aiEnrichContract({
      userId: 'user-123',
      documentId: 'doc-abc-456',
      templateId: 'template-1',
      placeholders: ['CLIENTE', '<<VALOR_TOTAL>>', 'DATA.DE.INICIO'],
      entityData: {},
      context: 'Contrato de prestação de serviços',
      contractType: 'Contrato de Prestação de Serviços',
    });

    expect(result.success).toBe(true);
    expect(result.substitutions).toHaveLength(3);
    // All three should be matched regardless of bracket style
    const matchedPlaceholders = result.substitutions.map(s => s.placeholder);
    expect(matchedPlaceholders).toContain('CLIENTE');
    expect(matchedPlaceholders).toContain('<<VALOR_TOTAL>>');
    expect(matchedPlaceholders).toContain('DATA.DE.INICIO');
  });
});