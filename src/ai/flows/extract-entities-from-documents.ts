
'use server';
/**
 * @fileOverview Extracts entities and a corresponding JSON Schema from a collection of documents using AI.
 *
 * - extractEntitiesFromDocuments - A function that handles the entity extraction process.
 * - ExtractEntitiesFromDocumentsInput - The input type for the function.
 * - ExtractEntitiesFromDocumentsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractEntitiesFromDocumentsInputSchema = z.object({
  documents: z.array(
    z.object({
      url: z.string().describe('The data URI of the document.'),
    })
  ),
});

export type ExtractEntitiesFromDocumentsInput = z.infer<
  typeof ExtractEntitiesFromDocumentsInputSchema
>;

const ExtractEntitiesFromDocumentsOutputSchema = z.object({
  extractedJson: z.object({
    entities: z.any().describe('An object where keys are the extracted entity names and values are the extracted entity values.'),
    schema: z.any().describe('A valid JSON schema object describing the extracted entities. Each property in the schema should have a \"description\" explaining what the entity represents.'),
  }).describe('The structured JSON containing both the extracted key-value pairs and their corresponding JSON schema with descriptions.')
});

export type ExtractEntitiesFromDocumentsOutput = z.infer<
  typeof ExtractEntitiesFromDocumentsOutputSchema
>;

import { withCache } from '@/lib/cache';

export async function extractEntitiesFromDocuments(
  input: ExtractEntitiesFromDocumentsInput
): Promise<ExtractEntitiesFromDocumentsOutput> {
  return withCache('extractEntities', input, () => extractEntitiesFlow(input));
}

const extractEntitiesPrompt = ai.definePrompt({
  name: 'extractEntitiesPrompt',
  input: { schema: ExtractEntitiesFromDocumentsInputSchema },
  output: {
    format: 'json',
    schema: ExtractEntitiesFromDocumentsOutputSchema,
  },
  prompt: `### PERSONA
Você é um Especialista em Processamento de Linguagem Natural e Automação de Documentos Administrativos. Sua tarefa é extrair dados de documentos de texto e mapeá-los para variáveis específicas de um modelo de contrato.

### PROCESSO DE PENSAMENTO (Mental Cleanup)
Antes de extrair qualquer dado, siga estas etapas:
1. **Identificação de Ruído:** Identifique tags de formatação HTML (ex: <em>, <li>, <p>, <span>, <div>).
2. **Filtro de Fechamento:** Descarte imediatamente qualquer termo que comece com "/" (ex: </li>, </em>, /EM, /LI), pois são apenas fechamentos de estilo ou ruídos de formatação.
3. **Identificação de Dados:** Identifique informações de negócio relevantes (nomes, valores, datas, objetos) presentes no texto, associando-as ao seu contexto (ex: texto "Projeto: Reforma da Biblioteca" indica que a entidade "NOME_PROJETO" é "Reforma da Biblioteca").
4. **Extração Pura:** Ignore as tags de estilo ao redor dos dados e extraia apenas a informação semântica contida nos documentos.

### OBJETIVO
Identificar e extrair todas as informações que correspondem a potenciais entidades úteis para preencher contratos de cooperação.

Busque por termos descritivos como "Nome", "Data", "Valor", "Objeto", "Vigência", "CPF/CNPJ", "Endereço", etc.

### DOCUMENTOS PARA ANÁLISE
{{#each documents}}
- {{media url=this.url}}
{{/each}}

### DIRETRIZES DE EXTRAÇÃO
1. **Eliminação de Ruído (CRÍTICO):** Ignore COMPLETAMENTE qualquer termo ou tag que pareça formatação HTML pura sem dado de negócio.
   - NÃO extraia termos como: EM, LI, OL, P, STRONG, SPAN, DIV, BR.
2. **Extração Semântica:** Busque nos documentos fornecidos a informação que melhor se encaixe no contexto de um contrato administrativo, independente da formatação. Extraia nomes de partes, datas de assinatura, valores contratuais, e descrições de objeto, inferindo o significado pelo texto ao redor (rótulos).

### REGRAS DE FORMATAÇÃO
- **Chaves (Keys):** Use SNAKE_CASE_MAIÚSCULO (ex: VALOR_TOTAL_CONTRATO). 
  - **DICA**: Remova símbolos como <, >, {, }, [, ], @, # das chaves.
  - Extraia apenas o significado semântico (ex: se vir "<<nome do coordenador>>", use a chave "NOME_COORDENADOR").
- **Valores (Values):** Extraia o texto exatamente como aparece no documento. Se for data, mantenha o formato original.
- **Descrições (Schema):** Crie explicações técnicas para cada campo.

### FORMATO DE SAÍDA (JSON)
Retorne estritamente um JSON com a seguinte estrutura:
{
  "entities": { "CHAVE": "Valor" },
  "schema": {
    "type": "object",
    "properties": {
      "CHAVE": { "type": "string", "description": "Explicação concisa" }
    }
  }
}

### REGRAS CRÍTICAS
- Não invente informações. Se não houver dados, retorne objetos vazios.
- Nunca retorne tags HTML (como EM, LI, P) como chaves de entidades.
- Agrupe endereços em uma única string coerente se estiverem espalhados.
- Se um bloco de texto for puramente formatação ou estrutura de documento sem dados variáveis, ignore-o.
`,
});

const extractEntitiesFlow = ai.defineFlow(
  {
    name: 'extractEntitiesFlow',
    inputSchema: ExtractEntitiesFromDocumentsInputSchema,
    outputSchema: ExtractEntitiesFromDocumentsOutputSchema,
  },
  async input => {
    const llmResponse = await extractEntitiesPrompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error('No output was generated by the AI.');
    }

    // Sanitize entity keys to prevent Handlebars interpretation issues
    const sanitizedEntities: Record<string, any> = {};
    const sanitizedProperties: Record<string, any> = {};

    if (output.extractedJson.entities) {
      Object.entries(output.extractedJson.entities).forEach(([key, value]) => {
        // Remove angle brackets, curly braces, and forward slashes from keys
        const cleanKey = key.replace(/[<>{} \/]/g, '').trim().toUpperCase().replace(/\s+/g, '_');
        if (cleanKey) { // Only add if key is not empty after cleaning
          sanitizedEntities[cleanKey] = value;
        }
      });
    }

    if (output.extractedJson.schema?.properties) {
      Object.entries(output.extractedJson.schema.properties).forEach(([key, value]) => {
        const cleanKey = key.replace(/[<>{} \/]/g, '').trim().toUpperCase().replace(/\s+/g, '_');
        if (cleanKey) {
          sanitizedProperties[cleanKey] = value;
        }
      });
    }

    return {
      extractedJson: {
        entities: sanitizedEntities,
        schema: {
          ...output.extractedJson.schema,
          properties: sanitizedProperties,
        },
      },
    };
  }
);
