
'use server';
/**
 * @fileOverview Matches template placeholders to extracted entities using AI semantic understanding.
 * 
 * This flow solves the problem where placeholder names don't exactly match entity names.
 * For example, a placeholder "REITOR" should match entity "NOME_DO_REITOR".
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MatchEntitiesToPlaceholdersInputSchema = z.object({
    placeholders: z.array(z.string()).describe('Array of placeholder names from the template'),
    entities: z.record(z.string(), z.any()).describe('Object mapping entity names to their values'),
    entityDescriptions: z.record(z.string(), z.string()).optional().describe('Optional descriptions of what each entity represents'),
});

export type MatchEntitiesToPlaceholdersInput = z.infer<
    typeof MatchEntitiesToPlaceholdersInputSchema
>;

const MatchEntitiesToPlaceholdersOutputSchema = z.object({
    reasoning: z.string().describe('Explain your thought process for the matches. Analyze potential ambiguity and explain why you rejected false positives.'),
    matches: z.array(z.object({
        placeholder: z.string().describe('The placeholder name from the template'),
        entityKey: z.string().describe('The entity key that should fill this placeholder'),
        confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Confidence level of the match'),
    })).describe('Array of placeholder-to-entity mappings. Only include placeholders that have a clear match.'),
});

export type MatchEntitiesToPlaceholdersOutput = z.infer<
    typeof MatchEntitiesToPlaceholdersOutputSchema
>;

export async function matchEntitiesToPlaceholders(
    input: MatchEntitiesToPlaceholdersInput
): Promise<MatchEntitiesToPlaceholdersOutput> {
    return matchEntitiesFlow(input);
}

const matchEntitiesPrompt = ai.definePrompt({
    name: 'matchEntitiesPrompt',
    model: 'googleai/gemini-3-pro-preview',
    input: { schema: MatchEntitiesToPlaceholdersInputSchema },
    output: {
        format: 'json',
        schema: MatchEntitiesToPlaceholdersOutputSchema,
    },
    config: {
        // Pre-format the data to avoid Handlebars interpreting placeholder content
        inputTransform: (input: MatchEntitiesToPlaceholdersInput) => {
            // Helper function to escape strings that might be interpreted as Handlebars syntax
            // We need to be very aggressive with escaping because Genkit uses Handlebars
            const escapeHandlebars = (str: any): string => {
                if (str === null || str === undefined) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/{{/g, '&#123;&#123;')
                    .replace(/}}/g, '&#125;&#125;');
            };

            const placeholdersList = input.placeholders
                .map(p => `- ${escapeHandlebars(p)}`)
                .join('\n');

            const entitiesList = Object.entries(input.entities)
                .map(([key, value]) => `- Key: "${escapeHandlebars(key)}", Valor: "${escapeHandlebars(value)}"`)
                .join('\n');

            const descriptionsList = input.entityDescriptions
                ? Object.entries(input.entityDescriptions)
                    .map(([key, desc]) => `- ${escapeHandlebars(key)}: ${escapeHandlebars(desc)}`)
                    .join('\n')
                : '';

            return {
                placeholdersList,
                entitiesList,
                descriptionsList,
                hasDescriptions: !!input.entityDescriptions && Object.keys(input.entityDescriptions).length > 0,
            };
        },
    },
    prompt: `Você é um especialista em contratos administrativos brasileiros. Conecte cada Placeholder à Entidade correspondente.

## REGRAS
1. **PREFIRA MATCH IMPERFEITO a deixar vazio.** Prioridade: Exato > Palavras Parciais > Sinônimo > Contexto.
2. Se 2+ palavras coincidem (ex: UNIDADE + DESCENTRALIZ), faça o match.
3. Ignore tags HTML. Evite apenas conexões obviamente erradas.

## DADOS
**Placeholders:**
{{placeholdersList}}

**Entidades:**
{{entitiesList}}
{{#if hasDescriptions}}

**Descrições:**
{{descriptionsList}}
{{/if}}

## SINÔNIMOS COMUNS
- NOME DO PROJETO ≈ OBJETO
- CPF ≈ CPF_AUTORIDADE, DOCUMENTO_REPRESENTANTE
- DATA ≈ DATA_ASSINATURA, DATA_INICIO
- VALOR ≈ VALOR_TOTAL, MONTANTE
- REITOR/COORDENADOR ≈ AUTORIDADE_COMPETENTE

## CONFIANÇA
- **HIGH:** 3+ palavras coincidentes
- **MEDIUM:** 2 palavras ou sinônimo claro
- **LOW:** 1 palavra com contexto válido

Retorne JSON com "reasoning" (breve) e "matches" (inclua MEDIUM ou superior).
`,
});

const matchEntitiesFlow = ai.defineFlow(
    {
        name: 'matchEntitiesFlow',
        inputSchema: MatchEntitiesToPlaceholdersInputSchema,
        outputSchema: MatchEntitiesToPlaceholdersOutputSchema,
    },
    async input => {
        console.log('--- MATCH ENTITIES DEBUG ---');
        console.log('Placeholders:', JSON.stringify(input.placeholders));
        console.log('Entities:', JSON.stringify(input.entities));

        try {
            const llmResponse = await matchEntitiesPrompt(input);
            const output = llmResponse.output;

            // Handle null or undefined responses from AI
            if (!output || output === null) {
                console.warn('AI returned null/undefined response, returning empty matches');
                return {
                    reasoning: 'O modelo de IA não conseguiu gerar correspondências para os placeholders fornecidos. Por favor, preencha os campos manualmente.',
                    matches: [],
                };
            }

            // Validate the output has the required fields
            if (!output.reasoning || !output.matches) {
                console.warn('AI response missing required fields:', output);
                return {
                    reasoning: output.reasoning || 'Análise incompleta do modelo de IA. Por favor, preencha os campos manualmente.',
                    matches: Array.isArray(output.matches) ? output.matches : [],
                };
            }

            return {
                reasoning: output.reasoning,
                matches: output.matches,
            };
        } catch (error) {
            // Catch any errors during AI matching and return gracefully
            console.error('Error during AI matching:', error);
            return {
                reasoning: 'Erro ao processar correspondências com IA. Por favor, preencha os campos manualmente.',
                matches: [],
            };
        }
    }
);
