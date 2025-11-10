// src/ai/flows/generate-contract-from-documents.ts
'use server';
/**
 * @fileOverview Generates a contract draft in Markdown format from uploaded documents using the Gemini API.
 *
 * - generateContractFromDocuments - A function that orchestrates the contract generation process.
 * - GenerateContractFromDocumentsInput - The input type for the generateContractFromDocuments function.
 * - GenerateContractFromDocumentsOutput - The return type for the generateContractFromDocuments function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const GenerateContractFromDocumentsInputSchema = z.object({
  documents: z.array(
    z.object({
      url: z.string().describe('The data URI of the document.'),
    })
  ),
});

export type GenerateContractFromDocumentsInput = z.infer<
  typeof GenerateContractFromDocumentsInputSchema
>;

const GenerateContractFromDocumentsOutputSchema = z.object({
  contractDraft: z
    .string()
    .describe('The generated contract draft in Markdown format.'),
});

export type GenerateContractFromDocumentsOutput = z.infer<
  typeof GenerateContractFromDocumentsOutputSchema
>;

export async function generateContractFromDocuments(
  input: GenerateContractFromDocumentsInput
): Promise<GenerateContractFromDocumentsOutput> {
  return generateContractFromDocumentsFlow(input);
}

const generateContractPrompt = ai.definePrompt({
  name: 'generateContractPrompt',
  input: {schema: GenerateContractFromDocumentsInputSchema},
  output: {schema: GenerateContractFromDocumentsOutputSchema},
  tools: [googleAI.fileSearch()],
  prompt: `Você é um especialista em direito administrativo e contratos de cooperação.
Com base nos documentos disponíveis (Plano de Trabalho, Termo de Execução, Planilha de Orçamento), que devem ser consultados usando a ferramenta de busca de arquivos, gere uma minuta de contrato completa em Markdown, estruturada e pronta para ser preenchida. Utilize os dados dos documentos para preencher os campos relevantes do contrato.

Os documentos para análise são:
{{#each documents}}
- {{media url=this.url}}
{{/each}}
`,
});

const generateContractFromDocumentsFlow = ai.defineFlow(
  {
    name: 'generateContractFromDocumentsFlow',
    inputSchema: GenerateContractFromDocumentsInputSchema,
    outputSchema: GenerateContractFromDocumentsOutputSchema,
  },
  async input => {
    const {output} = await generateContractPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate a contract draft.');
    }
    return output;
  }
);
