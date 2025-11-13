// src/ai/flows/get-assistance-from-gemini.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for getting assistance from Gemini while filling out a contract.
 *
 * It includes:
 * - getAssistanceFromGemini: An async function that takes a query and contract context and returns an answer from Gemini.
 * - GetAssistanceFromGeminiInput: The input type for the getAssistanceFromGemini function, including the query and contract content.
 * - GetAssistanceFromGeminiOutput: The output type for the getAssistanceFromGemini function, which is a string containing the answer from Gemini.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const GetAssistanceFromGeminiInputSchema = z.object({
  query: z.string().describe('The question to ask Gemini about the contract.'),
  contractContent: z.string().describe('The current content of the contract.'),
  clauseContent: z.string().optional().describe('The content of the current clause, if available.'),
});

export type GetAssistanceFromGeminiInput = z.infer<typeof GetAssistanceFromGeminiInputSchema>;

const GetAssistanceFromGeminiOutputSchema = z.object({
  answer: z.string().describe('The answer from Gemini.'),
});

export type GetAssistanceFromGeminiOutput = z.infer<typeof GetAssistanceFromGeminiOutputSchema>;

export async function getAssistanceFromGemini(input: GetAssistanceFromGeminiInput): Promise<GetAssistanceFromGeminiOutput> {
  return getAssistanceFromGeminiFlow(input);
}

const getAssistanceFromGeminiPrompt = ai.definePrompt({
  name: 'getAssistanceFromGeminiPrompt',
  input: { schema: GetAssistanceFromGeminiInputSchema },
  output: { schema: GetAssistanceFromGeminiOutputSchema },
  model: 'googleai/gemini-1.5-flash-latest',
  prompt: `Você é um assistente de contratos especializado em contratos administrativos de cooperação entre o V-Lab e a UFPE.

  Você deve responder às perguntas do usuário com base no conteúdo do contrato e, se disponível, no conteúdo da cláusula atual.

  Se a pergunta não puder ser respondida com base no conteúdo fornecido, você pode usar seu conhecimento geral para fornecer uma resposta.

  Conteúdo do Contrato:
  {{contractContent}}

  {{#if clauseContent}}
  Conteúdo da Cláusula Atual:
  {{clauseContent}}
  {{/if}}

  Pergunta: {{query}}

  Resposta:`,
});

const getAssistanceFromGeminiFlow = ai.defineFlow(
  {
    name: 'getAssistanceFromGeminiFlow',
    inputSchema: GetAssistanceFromGeminiInputSchema,
    outputSchema: GetAssistanceFromGeminiOutputSchema,
  },
  async input => {
    const { output } = await getAssistanceFromGeminiPrompt(input);
    return output!;
  }
);
