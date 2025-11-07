
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
import {z} from 'genkit';
import { fileSearch, search } from '../services/file-search';

const GenerateContractFromDocumentsInputSchema = z.object({
  fileIds: z.array(z.string()).describe('An array of file IDs to be searched.'),
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
  tools: [fileSearch, search],
  prompt: `Você é um especialista em direito administrativo e contratos de cooperação.
Com base nos documentos disponíveis através da ferramenta fileSearch (Plano de Trabalho, Termo de Execução, Planilha de Orçamento), gere uma minuta de contrato completa em Markdown, estruturada e pronta para ser preenchida. Utilize os dados dos documentos para preencher os campos relevantes do contrato.
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
    return output!;
  }
);
