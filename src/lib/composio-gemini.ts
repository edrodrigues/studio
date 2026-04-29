'use server';

/**
 * Composio + Gemini Integration Service
 *
 * Bridges Genkit's Gemini integration with Composio tools for agentic document operations.
 * Uses the existing Genkit infrastructure (@genkit-ai/google-genai) already configured in the project.
 *
 * This module provides:
 * 1. Composio tool definitions as Genkit tools for Gemini function calling (P3-T1)
 * 2. Agentic loop execution for complex multi-step operations (P3-T1)
 * 3. Simple inference helper for single-shot enrichment
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ============================================================
// COMPOSIO TOOL DEFINITIONS (for P3-T1 AI Review)
// ============================================================
// Note: These are registered with implementations that use the Composio client.
// In Genkit 1.x, ai.defineTool requires (config, implementation).
// These will be wired up properly in P3-T1.

// ============================================================
// SIMPLE INFERENCE HELPER
// ============================================================

/**
 * Simple single-shot inference with Gemini (no tool calling).
 * Use for enrichment when you just need Gemini to infer values from context.
 */
export async function inferWithGemini<T = Record<string, unknown>>(
  prompt: string,
  outputSchema?: z.ZodType<T>
): Promise<T> {
  if (outputSchema) {
    const response = await ai.generate({
      prompt,
      output: { schema: outputSchema },
      model: 'googleai/gemini-3-flash-preview',
    });
    return response.output as T;
  }

  const response = await ai.generate({
    prompt,
    model: 'googleai/gemini-3-flash-preview',
  });
  return response.text as unknown as T;
}

// ============================================================
// AGENTIC LOOP (simplified for P3-T1)
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
 * Simplified single-turn version that makes one Gemini call with tools available.
 * Full multi-turn implementation in P3-T1.
 */
export async function runComposioAgent(
  config: AgentLoopConfig,
  userMessage: string
): Promise<AgentLoopResult> {
  const systemPrompt = config.systemPrompt ||
    `Você é um assistente especializado em contratos administrativos brasileiros. Use as ferramentas disponíveis para ajudar com documentos Google Docs.`;

  const response = await ai.generate({
    prompt: userMessage,
    system: systemPrompt,
    model: 'googleai/gemini-3-flash-preview',
  });

  return {
    response: response.text || '',
    iterations: 1,
    toolsUsed: [],
  };
}
