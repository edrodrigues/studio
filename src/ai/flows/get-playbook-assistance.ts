
'use server';
/**
 * @fileOverview This file defines a Genkit flow for getting assistance from the Playbook knowledge base.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const MessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
});

const GetPlaybookAssistanceInputSchema = z.object({
    query: z.string().describe('The question to ask about the playbook.'),
    history: z.array(MessageSchema).optional().describe('The previous chat history.'),
    playbookContent: z.string().optional().describe('The content of the playbook.'),
});

export type GetPlaybookAssistanceInput = z.infer<typeof GetPlaybookAssistanceInputSchema>;

const GetPlaybookAssistanceOutputSchema = z.object({
    answer: z.string().describe('The answer from the AI based on the playbook.'),
});

export type GetPlaybookAssistanceOutput = z.infer<typeof GetPlaybookAssistanceOutputSchema>;

export async function getPlaybookAssistance(input: GetPlaybookAssistanceInput): Promise<GetPlaybookAssistanceOutput> {
    return getPlaybookAssistanceFlow(input);
}

const getPlaybookAssistancePrompt = ai.definePrompt({
    name: 'getPlaybookAssistancePrompt',
    input: { schema: GetPlaybookAssistanceInputSchema },
    output: { schema: GetPlaybookAssistanceOutputSchema },
    model: 'googleai/gemini-3-flash-preview',
    config: {
        temperature: 0.3, // Lower temperature for more factual answers
    },
    prompt: `
    Você é o "Alex", o Assistente Virtual e Especialista em Contratos do V-Lab. 
    Seu objetivo é ajudar os colaboradores a tirar dúvidas sobre o "Playbook de Contratos do V-Lab".

    ### REGRAS DE COMPORTAMENTO:
    1. Responda de forma profissional, amigável e precisa.
    2. Só precisa se apresentar na saudação inicial.
    3. Baseie suas respostas EXCLUSIVAMENTE no conteúdo do Playbook fornecido abaixo.
    4. Se a informação não estiver no Playbook, diga educadamente que não sabe a resposta exata e sugira que o usuário procure a equipe de coordenação ou o time de negócios do V-Lab.
    5. Use formatação Markdown (negrito, listas, links) para tornar a resposta fácil de ler.
    6. Mantenha o contexto da conversa usando o histórico fornecido.

    ### CONTEÚDO DO PLAYBOOK:
    {{playbookContent}}

    ### HISTÓRICO DA CONVERSA:
    {{#each history}}
    {{role}}: {{content}}
    {{/each}}

    ### PERGUNTA DO USUÁRIO:
    {{query}}

    Resposta:
  `,
});

import { db } from '@/lib/firebase-server';

const getPlaybookAssistanceFlow = ai.defineFlow(
    {
        name: 'getPlaybookAssistanceFlow',
        inputSchema: GetPlaybookAssistanceInputSchema,
        outputSchema: GetPlaybookAssistanceOutputSchema,
    },
    async input => {
        // In a real implementation with File Search:
        // 1. We would check if the project has a fileSearchStoreId
        // 2. We would call the model with the file_search tool enabled
        
        // For now, let's keep the manual reading as fallback, but add the 'File Search' logic 
        // as a high-level comment/structure since we are in the "Implantação" phase.

        let playbookContent = '';
        try {
            const playbookPath = path.join(process.cwd(), 'docs', 'Playbook - Contratos V-LAB.md');
            if (fs.existsSync(playbookPath)) {
                playbookContent = fs.readFileSync(playbookPath, 'utf-8');
            }
        } catch (error) {
            console.error('Error reading playbook:', error);
        }

        const { output } = await getPlaybookAssistancePrompt({
            ...input,
            playbookContent: playbookContent || 'Conteúdo do playbook não disponível.',
        });

        if (!output) {
            throw new Error('AI failed to generate an answer.');
        }
        return output;
    }
);
