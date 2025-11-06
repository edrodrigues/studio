
'use server';
/**
 * @fileOverview Extracts a generic template from a document using AI.
 *
 * - extractTemplateFromDocument - A function that handles the template extraction process.
 * - ExtractTemplateFromDocumentInput - The input type for the extractTemplateFromDocument function.
 * - ExtractTemplateFromDocumentOutput - The return type for the extractTemplateFromDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTemplateFromDocumentInputSchema = z.object({
  documentContent: z
    .string()
    .describe(
      "The base64-encoded content of the document to extract a template from."
    ),
});

export type ExtractTemplateFromDocumentInput = z.infer<typeof ExtractTemplateFromDocumentInputSchema>;

const ExtractTemplateFromDocumentOutputSchema = z.object({
  templateContent: z
    .string()
    .describe('The generated template in Markdown format.'),
});

export type ExtractTemplateFromDocumentOutput = z.infer<
  typeof ExtractTemplateFromDocumentOutputSchema
>;

export async function extractTemplateFromDocument(
  input: ExtractTemplateFromDocumentInput
): Promise<ExtractTemplateFromDocumentOutput> {
  return extractTemplateFlow(input);
}

const extractTemplatePrompt = ai.definePrompt({
  name: 'extractTemplatePrompt',
  input: {schema: ExtractTemplateFromDocumentInputSchema},
  output: {schema: ExtractTemplateFromDocumentOutputSchema},
  prompt: `Você é um especialista em criar modelos de documentos. Analise os exemplos de contratos preenchidos abaixo e crie um modelo genérico em formato Markdown.

Sua tarefa é identificar as partes que são variáveis (como nomes, datas, valores, descrições específicas) e substituí-las por placeholders no formato {{NOME_DA_VARIAVEL_EM_MAIUSCULAS}}.

O output deve ser APENAS o texto do modelo em Markdown, usando cabeçalhos de nível 1 (# TÍTULO DA CLÁUSULA) para cada cláusula. Não adicione nenhuma explicação extra.

Conteúdo do Contrato (decodificado de base64):
{{{documentContent}}}`,
});

const extractTemplateFlow = ai.defineFlow(
  {
    name: 'extractTemplateFlow',
    inputSchema: ExtractTemplateFromDocumentInputSchema,
    outputSchema: ExtractTemplateFromDocumentOutputSchema,
  },
  async input => {
    const {output} = await extractTemplatePrompt(input);
    return output!;
  }
);
