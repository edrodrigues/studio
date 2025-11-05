"use server";

import { generateContractFromDocuments } from "@/ai/flows/generate-contract-from-documents";
import { getAssistanceFromGemini } from "@/ai/flows/get-assistance-from-gemini";
import { extractTemplateFromDocument } from "@/ai/flows/extract-template-from-document";
import { z } from "zod";

const fileSchema = z.string().refine(s => s.startsWith('data:'), 'File must be a data URI');

const generateContractSchema = z.object({
  planOfWork: fileSchema,
  termOfExecution: fileSchema,
  budgetSpreadsheet: fileSchema,
});

export async function handleGenerateContract(formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = generateContractSchema.safeParse(rawData);

    if (!validatedData.success) {
      console.error("Validation failed", validatedData.error.flatten());
      return { success: false, error: "Dados de arquivo inválidos." };
    }

    const result = await generateContractFromDocuments(validatedData.data);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error generating contract:", error);
    return { success: false, error: "Falha ao gerar o contrato." };
  }
}

const getAssistanceSchema = z.object({
    query: z.string(),
    contractContent: z.string(),
    clauseContent: z.string().optional(),
});

export async function handleGetAssistance(input: {
    query: string;
    contractContent: string;
    clauseContent?: string;
}) {
    try {
        const validatedData = getAssistanceSchema.safeParse(input);
        if (!validatedData.success) {
            return { success: false, error: "Dados de entrada inválidos." };
        }
        const result = await getAssistanceFromGemini(validatedData.data);
        return { success: true, data: result };
    } catch (error) {
        console.error("Error getting assistance:", error);
        return { success: false, error: "Falha ao obter assistência." };
    }
}

const extractTemplateSchema = z.object({
    document: fileSchema,
});

export async function handleExtractTemplate(formData: FormData) {
    try {
        const rawData = Object.fromEntries(formData.entries());
        const validatedData = extractTemplateSchema.safeParse(rawData);

        if (!validatedData.success) {
            console.error("Validation failed", validatedData.error.flatten());
            return { success: false, error: "Dados de arquivo inválidos." };
        }

        const result = await extractTemplateFromDocument(validatedData.data);
        return { success: true, data: result };
    } catch (error) {
        console.error("Error extracting template:", error);
        return { success: false, error: "Falha ao extrair o modelo." };
    }
}
