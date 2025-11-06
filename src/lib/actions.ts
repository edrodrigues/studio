
"use server";

import { generateContractFromDocuments } from "@/ai/flows/generate-contract-from-documents";
import { getAssistanceFromGemini } from "@/ai/flows/get-assistance-from-gemini";
import { extractTemplateFromDocument } from "@/ai/flows/extract-template-from-document";
import { getDocumentFeedback } from "@/ai/flows/get-document-feedback";
import { extractEntitiesFromDocuments } from "@/ai/flows/extract-entities-from-documents";
import { z } from "zod";
import mammoth from "mammoth";

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
    documentContent: z.string(),
});

export async function handleExtractTemplate(formData: FormData) {
    try {
        const dataUri = formData.get("document") as string;

        if (!dataUri || !dataUri.startsWith('data:')) {
            return { success: false, error: "URI de documento inválido ou ausente." };
        }
        
        const base64Content = Buffer.from(dataUri.split(',')[1], 'base64').toString('utf-8');

        const validatedData = extractTemplateSchema.safeParse({
             documentContent: base64Content
        });

        if (!validatedData.success) {
            console.error("Validation failed", validatedData.error.flatten());
            return { success: false, error: "Conteúdo do documento inválido." };
        }

        const result = await extractTemplateFromDocument(validatedData.data);
        return { success: true, data: result };
    } catch (error) {
        console.error("Error extracting template:", error);
        const errorMessage = error instanceof Error ? error.message : "Falha ao extrair o modelo.";
        return { success: false, error: errorMessage };
    }
}

const getFeedbackSchema = z.object({
  systemPrompt: z.string(),
  documents: z.array(z.object({
    name: z.string(),
    dataUri: fileSchema,
    isText: z.boolean(),
  })),
});


export async function handleGetFeedback(input: {
    systemPrompt: string;
    documents: { name: string, dataUri: string, isText: boolean }[];
}) {
    try {
        const validatedData = getFeedbackSchema.safeParse(input);
        if (!validatedData.success) {
            console.error("Validation failed", validatedData.error.flatten());
            return { success: false, error: "Dados de entrada inválidos para o feedback." };
        }
        
        let formattedDocuments = "";
        for (const doc of validatedData.data.documents) {
            let content;
            if (doc.isText) {
                const buffer = Buffer.from(doc.dataUri.split(',')[1], 'base64');
                const { value } = await mammoth.extractRawText({ buffer });
                content = `\n\n${value}\n\n`;
            } else {
                content = `{{media url="${doc.dataUri}"}}`;
            }
            formattedDocuments += `### Documento: ${doc.name}\n${content}\n---\n`;
        }

        const result = await getDocumentFeedback({
            systemPrompt: validatedData.data.systemPrompt,
            formattedDocuments: formattedDocuments,
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("Error getting feedback:", error);
        const errorMessage = error instanceof Error ? error.message : "Falha ao obter feedback da IA.";
        return { success: false, error: errorMessage };
    }
}

const extractEntitiesSchema = z.object({
  documents: z.array(z.object({
    name: z.string(),
    dataUri: fileSchema,
  })),
});

export async function handleExtractEntities(input: {
    documents: { name: string, dataUri: string }[];
}) {
    try {
        const validatedData = extractEntitiesSchema.safeParse(input);
        if (!validatedData.success) {
            console.error("Validation failed", validatedData.error.flatten());
            return { success: false, error: "Dados de entrada inválidos para a extração de entidades." };
        }

        const formattedDocuments = validatedData.data.documents.map(doc => 
            `## Documento: ${doc.name}\n\n{{media url="${doc.dataUri}"}}`
        ).join('\n\n---\n\n');

        const result = await extractEntitiesFromDocuments({
            documentsAsText: formattedDocuments,
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("Error extracting entities:", error);
        const errorMessage = error instanceof Error ? error.message : "Falha ao extrair entidades.";
        return { success: false, error: errorMessage };
    }
}
