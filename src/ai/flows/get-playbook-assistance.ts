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
    usedFileSearch: z.boolean().describe('Whether File Search was used to answer the query.'),
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
): Promise<{ answer: string; error?: string }> {
    console.log('[ALEX FileSearch] === START ===');
    console.log('[ALEX FileSearch] Store ID:', fileSearchStoreId);
    console.log('[ALEX FileSearch] Query:', query.substring(0, 100));
    console.log('[ALEX FileSearch] History length:', history.length);
    
    try {
        const contents = [
            ...history.map(m => ({
                role: m.role === 'model' ? 'model' as const : 'user' as const,
                parts: [{ text: m.content }],
            })),
            { role: 'user' as const, parts: [{ text: query }] },
        ];

        const systemInstruction = buildSystemInstruction(playbookContent, true);

        console.log('[ALEX FileSearch] Calling Google GenAI API...');
        
        const response = await genaiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [fileSearchStoreId],
                        },
                    },
                ],
                systemInstruction,
                temperature: 0.3,
            },
        });

        console.log('[ALEX FileSearch] Response received');
        console.log('[ALEX FileSearch] Response text length:', response.text?.length ?? 0);
        
        const responseObj = response as unknown as { toolCalls?: unknown[] };
        if (responseObj.toolCalls && responseObj.toolCalls.length > 0) {
            console.log('[ALEX FileSearch] Tool calls returned:', JSON.stringify(responseObj.toolCalls, null, 2));
        }

        if (!response.text) {
            console.warn('[ALEX FileSearch] No text in response, checking candidates...');
            console.log('[ALEX FileSearch] Response:', JSON.stringify(response, null, 2));
        }

        console.log('[ALEX FileSearch] === END ===');
        return { answer: response.text ?? 'Desculpe, não consegui gerar uma resposta.' };
    } catch (error) {
        console.error('[ALEX FileSearch] === ERROR ===');
        console.error('[ALEX FileSearch] Error name:', error instanceof Error ? error.name : 'Unknown');
        console.error('[ALEX FileSearch] Error message:', error instanceof Error ? error.message : String(error));
        
        if (error instanceof Error && error.cause) {
            console.error('[ALEX FileSearch] Error cause:', error.cause);
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar nos documentos';
        console.error('[ALEX FileSearch] === END ERROR ===');
        
        return { 
            answer: 'Desculpe, houve um problema ao buscar nos documentos indexados.', 
            error: errorMessage 
        };
    }
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
        let usedFileSearch = false;

        // Check if the project has a File Search Store
        if (input.projectId) {
            try {
                const projectDoc = await db.collection('projects').doc(input.projectId).get();
                const projectData = projectDoc.data();

                if (projectData?.isSyncedToFileSearch && projectData?.fileSearchStoreId) {
                    const result = await generateWithFileSearch(
                        input.query,
                        history,
                        playbookContent,
                        projectData.fileSearchStoreId,
                    );
                    
                    if (result.error) {
                        console.error('[ALEX] File Search failed, falling back to Playbook:', result.error);
                    } else {
                        usedFileSearch = true;
                        return { answer: result.answer, usedFileSearch };
                    }
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
        return { answer: output.answer, usedFileSearch };
    }
);
