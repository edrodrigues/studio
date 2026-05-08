'use server';

/**
 * Composio + Google GenAI Integration Service
 *
 * Uses the CORRECT Composio pattern (per docs):
 * - composio.create(user_id) → session.tools()
 * - Native @google/genai client (not Genkit)
 * - Agentic loop: Gemini → tool calls → execute → re-prompt → text
 *
 * Reference: https://docs.composio.dev/docs/providers/google
 */

import { Composio } from '@composio/core';
import { GoogleProvider } from '@composio/google';
import { GoogleGenAI, type Part } from '@google/genai';

// Initialize Composio with Google provider
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new GoogleProvider(),
});

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
});

// ============================================================
// SIMPLE INFERENCE HELPER
// ============================================================

/**
 * Simple single-shot inference with Gemini (no tool calling).
 * Use for enrichment when you just need Gemini to infer values from context.
 */
export async function inferWithGemini<T = Record<string, unknown>>(
  prompt: string,
  outputSchema?: object
): Promise<T> {
  const model = 'gemini-2.0-flash'; // Stable, widely supported model

  if (outputSchema) {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: outputSchema,
      },
    });
    const text = response.text || '{}';
    return JSON.parse(text) as T;
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return response.text as unknown as T;
}

// ============================================================
// AGENTIC LOOP (correct Composio pattern)
// ============================================================

export interface AgentLoopConfig {
  userId: string;
  maxIterations?: number;
  systemPrompt?: string;
}

export interface AgentLoopResult {
  response: string;
  iterations: number;
  toolsUsed: string[];
}

/**
 * Runs an agentic loop where Gemini decides which Composio tools to call.
 * Uses the correct Composio pattern from docs:
 * 1. composio.create(userId) → get session
 * 2. session.tools() → get tools in Gemini format
 * 3. Pass tools to Gemini chat
 * 4. Loop: Gemini → tool calls → execute → re-prompt → text
 */
export async function runComposioAgent(
  config: AgentLoopConfig,
  userMessage: string
): Promise<AgentLoopResult> {
  const userId = config.userId;
  const maxIterations = config.maxIterations || 10;
  const systemPrompt = config.systemPrompt ||
    `Você é um assistente especializado em contratos administrativos brasileiros. Use as ferramentas disponíveis para ajudar com documentos Google Docs.`;

  const toolsUsed: string[] = [];
  let iterations = 0;

  try {
    // Step 1: Create Composio session for this user
    const session = await composio.create(userId);

    // Step 2: Get tools in Gemini function calling format
    const tools = await session.tools();

    // Step 3: Create chat with tools
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: tools }],
      },
    });

    // Step 4: Initial message
    let response = await chat.sendMessage({
      message: userMessage,
    });

    // Step 5: Agentic loop - execute tool calls until text response
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < maxIterations) {
      iterations++;

      const parts: Part[] = [];

      for (const fc of response.functionCalls) {
        const toolName = fc.name || 'unknown';
        toolsUsed.push(toolName);

        console.info('[Composio Agent] Executing tool:', toolName, fc.args);

        // Execute the tool call via Composio provider
        const result = await composio.provider.executeToolCall(userId, {
          name: toolName,
          args: (fc.args || {}) as Record<string, unknown>,
        });

        parts.push({
          functionResponse: {
            id: fc.id,
            name: toolName,
            response: typeof result === 'string' ? { output: result } : (result as Record<string, unknown>),
          },
        } as Part);
      }

      // Re-prompt with tool results
      response = await chat.sendMessage({ message: JSON.stringify(parts) as any });
    }

    if (iterations >= maxIterations) {
      console.warn('[Composio Agent] Max iterations reached:', maxIterations);
    }

    return {
      response: response.text || '',
      iterations,
      toolsUsed: [...new Set(toolsUsed)], // Deduplicate
    };
  } catch (error) {
    console.error('[Composio Agent] Error:', error);
    throw error;
  }
}
