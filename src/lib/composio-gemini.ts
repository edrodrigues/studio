'use server';

/**
 * Composio + Google GenAI Integration Service
 *
 * Uses the CORRECT Composio v3 pattern (per docs):
 * - composio.create(user_id) → session per request
 * - session.tools() → tools in Gemini function calling format
 * - composio.provider.executeToolCall() → execute tool calls in agentic loop
 * - Native @google/genai client (not Genkit)
 * - Agentic loop: Gemini → tool calls → execute → re-prompt → text
 *
 * Reference: https://docs.composio.dev/docs/providers/google
 */

import { Composio } from '@composio/core';
import { GoogleProvider } from '@composio/google';
import { GoogleGenAI, type Part } from '@google/genai';

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
  const model = 'gemini-2.0-flash';

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
// AGENTIC LOOP (v3 Composio pattern)
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
 * Uses the correct v3 Composio pattern from docs:
 * 1. new Composio({ provider }) → create base instance per request
 * 2. composio.create(userId) → session for this user
 * 3. session.tools() → get tools in Gemini format
 * 4. Loop: Gemini → tool calls → composio.provider.executeToolCall() → re-prompt → text
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
    // Step 1: Create Composio base instance with Google provider (per request)
    const composio = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      provider: new GoogleProvider(),
    });

    // Step 2: Create session for this user (v3 pattern)
    const session = await composio.create(userId, {
      toolkits: ['googledocs', 'googledrive'],
      tools: {
        googledocs: {
          enable: [
            'GOOGLEDOCS_COPY_DOCUMENT',
            'GOOGLEDOCS_CREATE_DOCUMENT',
            'GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN',
            'GOOGLEDOCS_CREATE_DOCUMENT2',
            'GOOGLEDOCS_CREATE_FOOTER',
            'GOOGLEDOCS_CREATE_FOOTNOTE',
            'GOOGLEDOCS_CREATE_HEADER',
            'GOOGLEDOCS_SEARCH_DOCUMENTS',
            'GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT',
            'GOOGLEDOCS_REPLACE_ALL_TEXT',
            'GOOGLEDOCS_GET_DOCUMENT_BY_ID',
            'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
          ],
        },
        googledrive: {
          enable: [
            'GOOGLEDRIVE_GET_FILE_V2',
            'GOOGLEDRIVE_COPY_FILE_ADVANCED',
            'GOOGLEDRIVE_CREATE_PERMISSION',
          ],
        },
      },
      authConfigs: {
        googledocs: process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID || 'ac_hhBpnP-HVtg0',
      },
      connectedAccounts: {
        googledocs: process.env.COMPOSIO_GOOGLE_CONNECTED_ACCOUNT_ID || 'ca_aj67cMI66mzi',
        googledrive: process.env.COMPOSIO_GOOGLE_CONNECTED_ACCOUNT_ID || 'ca_aj67cMI66mzi',
      },
      manageConnections: {
        waitForConnections: true,
      },
    });

    // Step 3: Get tools in Gemini function calling format
    const tools = await session.tools();

    // Step 4: Create chat with tools
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: tools }],
      },
    });

    // Step 5: Initial message
    let response = await chat.sendMessage({
      message: userMessage,
    });

    // Step 6: Agentic loop — execute tool calls until text response
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < maxIterations) {
      iterations++;

      const parts: Part[] = [];

      for (const fc of response.functionCalls) {
        const toolName = fc.name || 'unknown';
        toolsUsed.push(toolName);

        console.info('[Composio Agent] Executing tool:', toolName, fc.args);

        // Execute the tool call via Composio provider (documented pattern for agentic loops)
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
      toolsUsed: [...new Set(toolsUsed)],
    };
  } catch (error) {
    console.error('[Composio Agent] Error:', error);
    throw error;
  }
}
