
'use server';
/**
 * @fileOverview Analyzes consistency across multiple documents, checking alignment on key parameters.
 *
 * - analyzeDocumentConsistency - A function that handles the consistency analysis process.
 * - AnalyzeDocumentConsistencyInput - The input type for the analyzeDocumentConsistency function.
 * - AnalyzeDocumentConsistencyOutput - The return type for the analyzeDocumentConsistency function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeDocumentConsistencyInputSchema = z.object({
    systemPrompt: z
        .string()
        .describe('The customizable system prompt to guide the AI consistency analysis.'),
    documents: z.array(
        z.object({
            url: z.string().describe('The data URI of the document.'),
        })
    ),
});

export type AnalyzeDocumentConsistencyInput = z.infer<
    typeof AnalyzeDocumentConsistencyInputSchema
>;

const AnalyzeDocumentConsistencyOutputSchema = z.object({
    consistencyPercentage: z
        .number()
        .min(0)
        .max(100)
        .describe('A percentage from 0 to 100 indicating how aligned the documents are.'),
    analysis: z
        .string()
        .describe('Detailed analysis of the document consistency in Markdown format.'),
    suggestions: z
        .array(z.string())
        .describe('A list of actionable suggestions to improve document alignment.'),
});

export type AnalyzeDocumentConsistencyOutput = z.infer<
    typeof AnalyzeDocumentConsistencyOutputSchema
>;

import { withCache } from '@/lib/cache';

export async function analyzeDocumentConsistency(
    input: AnalyzeDocumentConsistencyInput
): Promise<AnalyzeDocumentConsistencyOutput> {
    return withCache('analyzeConsistency', input, () => analyzeDocumentConsistencyFlow(input));
}

const analyzeDocumentConsistencyPrompt = ai.definePrompt({
    name: 'analyzeDocumentConsistencyPrompt',
    input: { schema: AnalyzeDocumentConsistencyInputSchema },
    output: { schema: AnalyzeDocumentConsistencyOutputSchema },
    config: {
        maxOutputTokens: 8192,
        temperature: 0.7,
    },
    prompt: `{{systemPrompt}}

Analise os documentos fornecidos e verifique o alinhamento entre eles com base nos critérios especificados no prompt do sistema.

Você DEVE retornar:
1. **consistencyPercentage**: Um número de 0 a 100 indicando o percentual de alinhamento entre os documentos.
2. **analysis**: Uma análise detalhada em formato Markdown explicando os pontos de alinhamento e desalinhamento encontrados.
3. **suggestions**: Uma lista de sugestões práticas e específicas para melhorar o alinhamento entre os documentos.

Os documentos para análise são:
{{#each documents}}
- {{media url=this.url}}
{{/each}}
`,
});

const analyzeDocumentConsistencyFlow = ai.defineFlow(
    {
        name: 'analyzeDocumentConsistencyFlow',
        inputSchema: AnalyzeDocumentConsistencyInputSchema,
        outputSchema: AnalyzeDocumentConsistencyOutputSchema,
    },
    async input => {
        const { output } = await analyzeDocumentConsistencyPrompt(input);
        if (!output) {
            throw new Error('AI failed to generate consistency analysis.');
        }
        return output;
    }
);
