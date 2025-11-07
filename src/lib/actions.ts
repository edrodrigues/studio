
"use server";

import { generateContractFromDocuments } from "@/ai/flows/generate-contract-from-documents";
import { getAssistanceFromGemini } from "@/ai/flows/get-assistance-from-gemini";
import { extractTemplateFromDocument } from "@/ai/flows/extract-template-from-document";
import { getDocumentFeedback } from "@/ai/flows/get-document-feedback";
import { extractEntitiesFromDocuments } from "@/ai/flows/extract-entities-from-documents";
import { z } from "zod";
import mammoth from "mammoth";
import { uploadFiles } from "@/ai/services/file-search";

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
    
    const fileIds = await uploadFiles([
      { name: "planOfWork", dataUri: validatedData.data.planOfWork },
      { name: "termOfExecution", dataUri: validatedData.data.termOfExecution },
      { name: "budgetSpreadsheet", dataUri: validatedData.data.budgetSpreadsheet },
    ]);

    const result = await generateContractFromDocuments({fileIds});
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
        const fileName = formData.get("fileName") as string;

        if (!dataUri || !dataUri.startsWith('data:')) {
            return { success: false, error: "URI de documento inválido ou ausente." };
        }
        
        let documentContent: string;
        const buffer = Buffer.from(dataUri.split(',')[1], 'base64');
        
        if (fileName.endsWith('.docx')) {
            const { value } = await mammoth.extractRawText({ buffer });
            documentContent = value;
        } else {
             // For PDFs and other formats, pass the data URI to be handled by the model
            documentContent = dataUri;
        }

        const validatedData = extractTemplateSchema.safeParse({
             documentContent: documentContent
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
  })),
});


export async function handleGetFeedback(input: {
    systemPrompt: string;
    documents: { name: string, dataUri: string}[];
}) {
    try {
        const validatedData = getFeedbackSchema.safeParse(input);
        if (!validatedData.success) {
            console.error("Validation failed", validatedData.error.flatten());
            return { success: false, error: "Dados de entrada inválidos para o feedback." };
        }
        
        const fileIds = await uploadFiles(validatedData.data.documents);

        const result = await getDocumentFeedback({
            systemPrompt: validatedData.data.systemPrompt,
            fileIds,
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

        const fileIds = await uploadFiles(validatedData.data.documents);

        const result = await extractEntitiesFromDocuments({
            fileIds,
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("Error extracting entities:", error);
        const errorMessage = error instanceof Error ? error.message : "Falha ao extrair entidades.";
        return { success: false, error: errorMessage };
    }
}
