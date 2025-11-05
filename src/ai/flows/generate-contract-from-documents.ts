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

const GenerateContractFromDocumentsInputSchema = z.object({
  planOfWork: z
    .string()
    .describe(
      'The Plan of Work document as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected description
    ),
  termOfExecution: z
    .string()
    .describe(
      'The Term of Execution document as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
  budgetSpreadsheet: z
    .string()
    .describe(
      'The Budget Spreadsheet document as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
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
  prompt: `Você é um especialista em direito administrativo e contratos de cooperação.
Com base nos documentos anexados, gere uma minuta de contrato completa em Markdown, estruturada e pronta para ser preenchida. Utilize os dados dos documentos para preencher os campos relevantes do contrato.

Plano de Trabalho: {{media url=planOfWork}}
Termo de Execução: {{media url=termOfExecution}}
Planilha de Orçamento: {{media url=budgetSpreadsheet}}`,
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
