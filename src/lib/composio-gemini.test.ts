import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// MOCK DEPENDENCIES — must be defined with vi.hoisted before vi.mock
// ============================================================

const { mockGoogleGenAI, mockChatsCreate, mockSendMessage, mockSessionTools, mockExecuteToolCall, mockComposioConstructor, mockComposioCreate, mockGenerateContent } = vi.hoisted(() => {
  const mockSendMessage = vi.fn();
  const mockChatsCreate = vi.fn(() => ({
    sendMessage: mockSendMessage,
  }));
  const mockSessionTools = vi.fn();
  const mockExecuteToolCall = vi.fn();
  const mockSession = { tools: mockSessionTools };
  const mockComposioCreate = vi.fn().mockResolvedValue(mockSession);
  // Composio constructor returns instance with create() and provider
  const mockComposioConstructor = vi.fn().mockImplementation(function() {
    return {
      create: mockComposioCreate,
      provider: {
        executeToolCall: mockExecuteToolCall,
      },
    };
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
    mockComposioConstructor,
    mockComposioCreate,
    mockGenerateContent,
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

vi.mock('@composio/core', () => ({
  Composio: mockComposioConstructor,
}));

vi.mock('@composio/google', () => ({
  GoogleProvider: vi.fn().mockImplementation(function() {}),
}));

// Import after mocks are set up
import { inferWithGemini, runComposioAgent } from './composio-gemini';

describe('composio-gemini (v3 session-based)', () => {
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
    it('creates a new Composio instance per request (v3 pattern)', async () => {
      mockSendMessage.mockResolvedValue({
        text: 'Response',
        functionCalls: undefined,
      });

      await runComposioAgent(
        { userId: 'user-123' },
        'Simple question'
      );

      // v3: new Composio() called per request, not singleton
      expect(mockComposioConstructor).toHaveBeenCalledTimes(1);
      expect(mockComposioCreate).toHaveBeenCalledWith('user-123');
    });

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

      mockExecuteToolCall.mockResolvedValue(JSON.stringify({ content: 'Document content' }));

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
      expect(result.toolsUsed).toContain('GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT');
      expect(mockExecuteToolCall).toHaveBeenCalledWith('user-123', {
        name: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
        args: { document_id: 'doc123' },
      });
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
      mockSendMessage.mockResolvedValue({
        functionCalls: [
          {
            id: 'call_x',
            name: 'SOME_TOOL',
            args: {},
          },
        ],
      });

      mockExecuteToolCall.mockResolvedValue('{}');

      const result = await runComposioAgent(
        { userId: 'user-123', maxIterations: 3 },
        'Complex task'
      );

      expect(result.iterations).toBeLessThanOrEqual(3);
      expect(result.response).toBe('');
    });
  });
});
