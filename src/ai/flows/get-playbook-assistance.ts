'use server';
/**
 * @fileOverview This file defines a Genkit flow for getting assistance from the Playbook knowledge base
 * and, optionally, from project documents indexed via File Search.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/firebase-server';
import { genaiClient } from '@/lib/google-ai-stores';

const MessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
});

const GetPlaybookAssistanceInputSchema = z.object({
    query: z.string().describe('The question to ask about the playbook.'),
    history: z.array(MessageSchema).optional().describe('The previous chat history.'),
    playbookContent: z.string().optional().describe('The content of the playbook.'),
    projectId: z.string().optional().describe('Optional project ID to include File Search context.'),
});

export type GetPlaybookAssistanceInput = z.infer<typeof GetPlaybookAssistanceInputSchema>;

const GetPlaybookAssistanceOutputSchema = z.object({
    answer: z.string().describe('The answer from the AI based on the playbook.'),
});

export type GetPlaybookAssistanceOutput = z.infer<typeof GetPlaybookAssistanceOutputSchema>;

export async function getPlaybookAssistance(input: GetPlaybookAssistanceInput): Promise<GetPlaybookAssistanceOutput> {
    return getPlaybookAssistanceFlow(input);
}

function loadPlaybookContent(): string {
    try {
        const playbookPath = path.join(process.cwd(), 'docs', 'Playbook - Contratos V-LAB.md');
        if (fs.existsSync(playbookPath)) {
            return fs.readFileSync(playbookPath, 'utf-8');
        }
    } catch (error) {
        console.error('Error reading playbook:', error);
    }
    return '';
}

const ALEX_BASE_INSTRUCTIONS = `
Você é o "Alex", o Assistente Virtual e Especialista em Contratos do V-Lab.
Seu objetivo é ajudar os colaboradores a tirar dúvidas sobre o "Playbook de Contratos do V-Lab"
e, quando disponível, sobre os documentos do projeto atual.

### REGRAS DE COMPORTAMENTO:
1. Responda de forma profissional, amigável e precisa.
2. Só precisa se apresentar na saudação inicial.
3. Use formatação Markdown (negrito, listas, links) para tornar a resposta fácil de ler.
4. Mantenha o contexto da conversa usando o histórico fornecido.
`.trim();

function buildSystemInstruction(playbookContent: string, hasFileSearch: boolean): string {
    let instruction = ALEX_BASE_INSTRUCTIONS;

    if (hasFileSearch) {
        instruction += `

### FONTES DE CONHECIMENTO:
Você tem acesso a DUAS fontes de informação:
1. **Playbook de Contratos do V-Lab** — As regras, diretrizes e procedimentos oficiais.
2. **Documentos do Projeto** — Documentos carregados e indexados no projeto atual (acessíveis via busca automática).

### COMO USAR AS FONTES:
- Para perguntas sobre **regras, procedimentos ou diretrizes**, baseie-se no Playbook.
- Para perguntas sobre **informações específicas de documentos, contratos, entidades ou dados do projeto**, use os documentos do projeto via busca.
- Se a informação for encontrada em ambas as fontes, cite de qual fonte você está extraindo a informação.
- Se a informação não estiver disponível em nenhuma das fontes, diga educadamente que não encontrou a resposta e sugira que o usuário procure a equipe de coordenação.`;
    } else {
        instruction += `

### FONTE DE CONHECIMENTO:
Baseie suas respostas EXCLUSIVAMENTE no conteúdo do Playbook fornecido abaixo.
Se a informação não estiver no Playbook, diga educadamente que não sabe a resposta exata e sugira que o usuário procure a equipe de coordenação ou o time de negócios do V-Lab.`;
    }

    if (playbookContent) {
        instruction += `\n\n### CONTEÚDO DO PLAYBOOK:\n${playbookContent}`;
    }

    return instruction;
}

// Genkit prompt used as fallback when File Search is not available
const getPlaybookAssistancePrompt = ai.definePrompt({
    name: 'getPlaybookAssistancePrompt',
    input: { schema: GetPlaybookAssistanceInputSchema },
    output: { schema: GetPlaybookAssistanceOutputSchema },
    model: 'googleai/gemini-3-flash-preview',
    config: {
        temperature: 0.3,
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

/**
 * Uses the @google/genai SDK directly with the fileSearch tool for grounded generation.
 */
async function generateWithFileSearch(
    query: string,
    history: { role: string; content: string }[],
    playbookContent: string,
    fileSearchStoreId: string,
): Promise<string> {
    const contents = [
        ...history.map(m => ({
            role: m.role === 'model' ? 'model' as const : 'user' as const,
            parts: [{ text: m.content }],
        })),
        { role: 'user' as const, parts: [{ text: query }] },
    ];

    const systemInstruction = buildSystemInstruction(playbookContent, true);

    const response = await genaiClient.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
        config: {
            tools: [{
                fileSearch: {
                    fileSearchStoreIds: [fileSearchStoreId],
                },
            }],
            systemInstruction,
            temperature: 0.3,
        },
    });

    return response.text ?? 'Desculpe, não consegui gerar uma resposta.';
}

const getPlaybookAssistanceFlow = ai.defineFlow(
    {
        name: 'getPlaybookAssistanceFlow',
        inputSchema: GetPlaybookAssistanceInputSchema,
        outputSchema: GetPlaybookAssistanceOutputSchema,
    },
    async input => {
        const playbookContent = loadPlaybookContent();
        const history = input.history ?? [];

        // Check if the project has a File Search Store
        if (input.projectId) {
            try {
                const projectDoc = await db.collection('projects').doc(input.projectId).get();
                const projectData = projectDoc.data();

                if (projectData?.isSyncedToFileSearch && projectData?.fileSearchStoreId) {
                    const answer = await generateWithFileSearch(
                        input.query,
                        history,
                        playbookContent,
                        projectData.fileSearchStoreId,
                    );
                    return { answer };
                }
            } catch (error) {
                console.error('Error accessing File Search for project, falling back to Playbook only:', error);
            }
        }

        // Fallback: Playbook-only via Genkit prompt
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
