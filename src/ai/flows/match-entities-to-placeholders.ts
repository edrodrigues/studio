
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
    matches: z.array(z.object({
        placeholder: z.string().describe('The placeholder name from the template'),
        entityKey: z.string().describe('The entity key that should fill this placeholder'),
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
    prompt: `Tarefa:
Você é um assistente especialista em análise de contratos. Sua tarefa é vincular "Placeholders" (variáveis de um modelo) a "Entidades" (valores extraídos de um documento).

Objetivo:
Para cada Placeholder, encontre a Entidade que melhor o preenche. O Placeholder pode vir no formato "<nome da variável>" ou apenas "nome da variável".

Dados de Entrada:
-----------------
1. Placeholders (do template):
{{placeholdersList}}

2. Entidades Disponíveis (extraídas):
{{entitiesList}}

{{#if hasDescriptions}}
3. Descrições (opcional):
{{descriptionsList}}
{{/if}}

Lógica de Análise e Correspondência:
1. **Classificação Inicial (FILTRO DE RUÍDO):** Para cada Placeholder, determine se ele representa um dado de negócio (ex: Nome, CPF, Data, Valor, Objeto, Unidade, Cargo) ou um ruído técnico/estilo (ex: EM, LI, P, STRONG, OL, UL, BR, SPAN, u, ou qualquer termo que comece com "/").
   - **CRÍTICO:** Se for identificado como ruído de estilo/formatacão, IGNORE-O IMEDIATAMENTE.
2. **Normalização de Busca:** Ao comparar, ignore a diferença entre espaços e underscores. "NOME_DO_PROJETO" é o mesmo que "NOME DO PROJETO".
3. **Análise Semântica:** Encontre a Entidade que melhor preenche o Placeholder, mesmo que os nomes sejam bem diferentes, desde que o conceito seja o mesmo (ex: "INSTITUIÇÃO" -> "UPE", "VALOR" -> "R$ 10.000,00").
4. **Validação de Negócio:** Somente faça o vínculo se a "Entidade" extraída preencher semanticamente a lacuna do "Placeholder".

Regras de Matching (Prioridade Descrescente):
1. Correspondência Exata ou Normalizada: "<NOME_PARCEIRO>" ou "NOME_PARCEIRO" == "NOME PARCEIRO" or "NOME_PARCEIRO"
2. Semântica/Sinônimos: "<Contratada>" pode ser preenchido por "RAZAO_SOCIAL", "NOME_DA_EMPRESA", "INSTITUICAO_PARCEIRA", "UNIDADE_EXECUTORA".
3. Conteúdo/Valor: Se o placeholder pede uma data e temos uma entidade com valor de data, avalie se é a data correta para aquele contexto.
4. Inferência Lógica Baseada no Contexto:
    - "GESTOR" pode ser "COORDENADOR_DO_PROJETO".
    - "UFPE" ou "UPE" geralmente é a "INSTITUICAO_EXECUTORA" ou apenas "INSTITUICAO".
    - "TÍTULO" pode ser "OBJETO" ou "NOME_DO_PROJETO".

Instruções Finais:
- Retorne APENAS o JSON válido.
- Se não houver match confiável ou se o placeholder for ruído HTML/estilo, NÃO inclua o placeholder na lista de matches.
- Seja conservador. É melhor não fazer um match do que fazer um match errado.
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

        const llmResponse = await matchEntitiesPrompt(input);
        const output = llmResponse.output;

        if (!output) {
            throw new Error('No output was generated by the AI.');
        }

        return {
            matches: output.matches,
        };
    }
);
