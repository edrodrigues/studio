import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// MOCK DEPENDENCIES — must be defined with vi.hoisted before vi.mock
// ============================================================

const { mockGoogleGenAI, mockChatsCreate, mockSendMessage, mockSessionTools, mockExecuteToolCall, mockComposioCreate, mockGenerateContent } = vi.hoisted(() => {
  const mockSendMessage = vi.fn();
  const mockChatsCreate = vi.fn(() => ({
    sendMessage: mockSendMessage,
  }));
  const mockSessionTools = vi.fn();
  const mockExecuteToolCall = vi.fn();
  const mockSession = { tools: mockSessionTools };
  const mockComposioInstance = {
    provider: {
      executeToolCall: mockExecuteToolCall,
    },
    create: vi.fn().mockResolvedValue(mockSession),
  };
  const mockComposioCreate = vi.fn().mockImplementation(function() {
    return mockComposioInstance;
  });
  const mockGenerateContent = vi.fn().mockResolvedValue({ text: 'Default response' });
  const mockGoogleGenAI = vi.fn().mockImplementation(function() {
    return {
      chats: { create: mockChatsCreate },
      models: { generateContent: mockGenerateContent },
    };
  });
  
  return {
    mockGoogleGenAI,
    mockChatsCreate,
    mockSendMessage,
    mockSessionTools,
    mockExecuteToolCall,
    mockComposioCreate,
    mockGenerateContent,
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

vi.mock('@composio/core', () => ({
  Composio: mockComposioCreate,
}));

vi.mock('@composio/google', () => ({
  GoogleProvider: vi.fn().mockImplementation(function() {}),
}));

// Import after mocks are set up
import { inferWithGemini, runComposioAgent } from './composio-gemini';

describe('composio-gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for inferWithGemini
    mockSendMessage.mockResolvedValue({
      text: 'Test response text',
    });
    
    // Default mock for tools
    mockSessionTools.mockResolvedValue([
      {
        name: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
        description: 'Get Google Doc content',
      },
    ]);
  });

  describe('inferWithGemini', () => {
    it('returns text response when no output schema is provided', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'Plain text response',
      });

      const result = await inferWithGemini('What is 2+2?');

      expect(result).toBe('Plain text response');
    });

    it('returns typed output when output schema is provided', async () => {
      mockGenerateContent.mockResolvedValue({
        text: '{"name": "Test", "value": 42}',
      });

      const result = await inferWithGemini<{ name: string; value: number }>(
        'Get person info',
        {} as any
      );

      expect(result).toEqual({ name: 'Test', value: 42 });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash',
          contents: 'Get person info',
        })
      );
    });
  });

  describe('runComposioAgent', () => {
    it('runs an agentic loop with Composio tools', async () => {
      // First response: Gemini requests tool calls
      mockSendMessage
        .mockResolvedValueOnce({
          functionCalls: [
            {
              id: 'call_1',
              name: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
              args: { document_id: 'doc123' },
            },
          ],
        })
        // Second response: Gemini returns text after tool execution
        .mockResolvedValueOnce({
          text: 'Agent response text',
          functionCalls: undefined,
        });

      mockSessionTools.mockResolvedValue([
        {
          name: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
          description: 'Get doc content',
        },
      ]);

      const result = await runComposioAgent(
        {
          userId: 'user-123',
          maxIterations: 5,
          systemPrompt: 'You are a helpful assistant.',
        },
        'Show me the document'
      );

      expect(result.response).toBe('Agent response text');
      expect(result.iterations).toBe(1); // 1 tool execution iteration
      expect(result.toolsUsed).toContain('GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT');
    });

    it('uses default system prompt when none provided', async () => {
      mockSendMessage.mockResolvedValue({
        text: 'Default agent response',
        functionCalls: undefined,
      });

      const result = await runComposioAgent(
        { userId: 'user-123' },
        'What can you do?'
      );

      expect(result.response).toBe('Default agent response');
      expect(result.iterations).toBe(0);
    });

    it('returns empty toolsUsed when no tools called', async () => {
      mockSendMessage.mockResolvedValue({
        text: 'Response with no tools',
        functionCalls: undefined,
      });

      const result = await runComposioAgent(
        { userId: 'user-123' },
        'Simple question'
      );

      expect(result.iterations).toBe(0);
      expect(result.toolsUsed).toEqual([]);
    });

    it('respects maxIterations limit', async () => {
      // Always return function calls (infinite loop simulation)
      mockSendMessage.mockResolvedValue({
        functionCalls: [
          {
            id: 'call_x',
            name: 'SOME_TOOL',
            args: {},
          },
        ],
      });

      const result = await runComposioAgent(
        { userId: 'user-123', maxIterations: 3 },
        'Complex task'
      );

      expect(result.iterations).toBeLessThanOrEqual(3);
      expect(result.response).toBe(''); // No text response due to max iterations
    });
  });
});
