import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// MOCK DEPENDENCIES — must be defined with vi.hoisted before vi.mock
// ============================================================

// Mock Genkit's ai module
const { mockAiGenerate } = vi.hoisted(() => ({
  mockAiGenerate: vi.fn(),
}));

vi.mock('@/ai/genkit', () => ({
  ai: {
    generate: mockAiGenerate,
    definePrompt: vi.fn(),
    defineTool: vi.fn(),
  },
}));

// Import after mocks are set up
import { inferWithGemini, runComposioAgent } from './composio-gemini';

describe('composio-gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiGenerate.mockResolvedValue({
      text: 'Test response text',
      output: null,
    });
  });

  describe('inferWithGemini', () => {
    it('returns text response when no output schema is provided', async () => {
      mockAiGenerate.mockResolvedValue({
        text: 'Plain text response',
        output: null,
      });

      const result = await inferWithGemini('What is 2+2?');

      expect(result).toBe('Plain text response');
      expect(mockAiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'What is 2+2?',
          model: 'googleai/gemini-3.1-flash-lite-preview',
        })
      );
    });

    it('returns typed output when output schema is provided', async () => {
      mockAiGenerate.mockResolvedValue({
        text: '{"name": "Test", "value": 42}',
        output: { name: 'Test', value: 42 },
      });

      const result = await inferWithGemini<{ name: string; value: number }>(
        'Get person info',
        // Using a simple object schema for the test
        {} as any
      );

      expect(result).toEqual({ name: 'Test', value: 42 });
      expect(mockAiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Get person info',
          model: 'googleai/gemini-3.1-flash-lite-preview',
        })
      );
    });
  });

  describe('runComposioAgent', () => {
    it('runs a single-turn agent with system prompt', async () => {
      mockAiGenerate.mockResolvedValue({
        text: 'Agent response text',
        output: null,
      });

      const result = await runComposioAgent(
        {
          userId: 'user-123',
          maxIterations: 5,
          systemPrompt: 'You are a helpful assistant.',
        },
        'Show me the document'
      );

      expect(result.response).toBe('Agent response text');
      expect(result.iterations).toBe(1);
      expect(result.toolsUsed).toEqual([]);
      expect(mockAiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Show me the document',
          system: 'You are a helpful assistant.',
          model: 'googleai/gemini-3.1-flash-lite-preview',
        })
      );
    });

    it('uses default system prompt when none provided', async () => {
      mockAiGenerate.mockResolvedValue({
        text: 'Default agent response',
        output: null,
      });

      const result = await runComposioAgent(
        { userId: 'user-123' },
        'What can you do?'
      );

      expect(result.response).toBe('Default agent response');
      expect(mockAiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('contratos administrativos brasileiros'),
        })
      );
    });

    it('returns empty toolsUsed for simplified single-turn implementation', async () => {
      mockAiGenerate.mockResolvedValue({
        text: 'Response with no tools',
        output: null,
      });

      const result = await runComposioAgent(
        { userId: 'user-123' },
        'Simple question'
      );

      expect(result.iterations).toBe(1);
      expect(result.toolsUsed).toEqual([]);
    });
  });
});
