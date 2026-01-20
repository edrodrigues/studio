
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
    prompt: `### TAREFA
Atue como um Especialista Sênior em Contratos e Análise de Dados. Sua missão é conectar **Placeholders** (lacunas de um modelo de contrato) às **Entidades** (dados extraídos de documentos) correspondentes.

### OBJETIVO PRINCIPAL
Para cada Placeholder, encontre a Entidade que melhor o preenche.
- **Prioridade:** Match Exato > Match Semântico/Sinônimo > Match por Contexto/Valor.
- **Evite:** Alucinações (inventar conexões sem lógica) e conexões com tipos de dados incompatíveis.

### DADOS DE ENTRADA
-----------------
**Placeholders (O que precisa ser preenchido):**
{{placeholdersList}}

**Entidades Disponíveis (Dados que temos):**
{{entitiesList}}

{{#if hasDescriptions}}
**Dicionário de Entidades (O que significa cada campo):**
{{descriptionsList}}
{{/if}}
-----------------

### PROCESSO DE PENSAMENTO (CoT)
Use o campo "reasoning" para documentar sua análise passo a passo:

1.  **Filtro de Ruído (CRÍTICO):** O placeholder parece uma tag HTML ou sujeira de formatação?
    *   IGNORAR: "STRONG", "BR", "LI", "DIV", "SPAN", "P", "UL", "OL", "EM", "NBSP", "CLASS", "STYLE".
    *   IGNORAR: Placeholders com caracteres estranhos ou muito curtos (ex: "A", "B").

2.  **Compatibilidade de Tipos (Validação de Valor):**
    *   O placeholder pede uma **DATA**? A entidade tem formato de data? (Não ligue "DATA_ASSINATURA" a "João Silva").
    *   O placeholder pede um **VALOR/DINHEIRO**? A entidade tem números/moeda?
    *   O placeholder pede **DOCUMENTO** (CPF/CNPJ)? A entidade tem dígitos suficientes?

3.  **Análise Semântica e Sinônimos:**
    *   "CONTRATADA" = "LOCATÁRIA" = "COMPRADORA" = "PRESTADORA" (dependendo do contexto).
    *   "CONTRATANTE" = "LOCADOR" = "VENDEDOR" = "TOMADOR".
    *   "OBJETO" = "DESCRICAO_SERVICO".

4.  **Pontuação de Confiança (Confidence Score):**
    *   **HIGH:** Nome quase idêntico ou sinônimo óbvio E tipos compatíveis.
    *   **MEDIUM:** Nome diferente, mas contexto e valores sugerem fortemente a conexão (Ex: Placeholder "VENCIMENTO" e Entidade "DATA_FINAL" com valor de data).
    *   **LOW:** Apenas um palpite vago. (Prefira não retornar match se for muito baixo, a menos que seja a única opção viável para algo obrigatório).

### EXEMPLOS (FEW-SHOT)

**Exemplo 1: Match por Sinônimo e Contexto**
*   Placeholder: "NOME_LOCATARIO"
*   Entidade: "RAZAO_SOCIAL" (Valor: "Empresa X Ltda") / Descrição: "Empresa que está alugando o imóvel"
*   *Decisão:* MATCH (HIGH). Embora os nomes sejam diferentes, o contexto (Ltda = empresa) e a semântica de contrato de locação validam.

**Exemplo 2: Match por Tipo de Dado**
*   Placeholder: "VIGENCIA_CONTRATO"
*   Entidades: "NOME" ("Carlos"), "DATA_INICIO" ("01/01/2024")
*   *Decisão:* MATCH (MEDIUM) com "DATA_INICIO". "NOME" é descartado por tipo incompatível.

**Exemplo 3: Ruído HTML**
*   Placeholder: "STRONG"
*   Entidade: "QUALQUER_COISA"
*   *Decisão:* IGNORAR. É tag HTML.

### FORMATO DE SAÍDA
Retorne um JSON com:
- "reasoning": Explicação breve das decisões tomadas.
- "matches": Array com os matches encontrados.
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
            reasoning: output.reasoning,
            matches: output.matches,
        };
    }
);
