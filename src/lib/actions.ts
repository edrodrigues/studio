
'use server';
import 'dotenv/config';

import { generateContractFromDocuments } from '@/ai/flows/generate-contract-from-documents';
import { getAssistanceFromGemini } from '@/ai/flows/get-assistance-from-gemini';
import { getDocumentFeedback } from '@/ai/flows/get-document-feedback';
import { extractEntitiesFromDocuments } from '@/ai/flows/extract-entities-from-documents';
import { analyzeDocumentConsistency } from '@/ai/flows/analyze-document-consistency';
import { convertDocumentsToSupportedFormats, convertBufferToSupportedDataUri } from '@/lib/document-converter';
import { z } from 'zod';

const fileSchema = z.string().refine(s => s.startsWith('data:'), {
  message: 'File must be a data URI',
});

const fileObjectSchema = z.object({
  name: z.string(),
  dataUri: fileSchema,
});

const generateContractSchema = z.object({
  documents: z.array(fileObjectSchema),
});

export async function handleGenerateContract(input: {
  documents: { name: string; dataUri: string }[];
}) {
  try {
    const validatedData = generateContractSchema.safeParse(input);

    if (!validatedData.success) {
      console.error('Validation failed', validatedData.error.flatten());
      return { success: false, error: 'Dados de arquivo inválidos.' };
    }

    // Convert documents to supported formats
    const convertedDocuments = await convertDocumentsToSupportedFormats(
      validatedData.data.documents
    );

    const documentsForFlow = convertedDocuments.map(doc => ({
      url: doc.dataUri,
    }));

    const result = await generateContractFromDocuments({
      documents: documentsForFlow,
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Error generating contract:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao gerar o contrato.';
    return { success: false, error: errorMessage };
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
      return { success: false, error: 'Dados de entrada inválidos.' };
    }
    const result = await getAssistanceFromGemini(validatedData.data);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting assistance:', error);
    return { success: false, error: 'Falha ao obter assistência.' };
  }
}

const getFeedbackSchema = z.object({
  systemPrompt: z.string(),
  documents: z.array(fileObjectSchema),
});

export async function handleGetFeedback(input: {
  systemPrompt: string;
  documents: { name: string; dataUri: string }[];
}) {
  try {
    const validatedData = getFeedbackSchema.safeParse(input);
    if (!validatedData.success) {
      console.error('Validation failed', validatedData.error.flatten());
      return {
        success: false,
        error: 'Dados de entrada inválidos para o feedback.',
      };
    }

    // Convert documents to supported formats
    const convertedDocuments = await convertDocumentsToSupportedFormats(
      validatedData.data.documents
    );

    const documentsForFlow = convertedDocuments.map(doc => ({
      url: doc.dataUri,
    }));

    const result = await getDocumentFeedback({
      systemPrompt: validatedData.data.systemPrompt,
      documents: documentsForFlow,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting feedback:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Falha ao obter feedback da IA.';
    return { success: false, error: errorMessage };
  }
}

const extractEntitiesSchema = z.object({
  documents: z.array(fileObjectSchema),
});

export async function handleExtractEntitiesAction(input: {
  documents: { name: string; dataUri: string }[];
}) {
  try {
    const validatedData = extractEntitiesSchema.safeParse(input);
    if (!validatedData.success) {
      console.error('Validation failed', validatedData.error.flatten());
      return {
        success: false,
        error: 'Dados de entrada inválidos para a extração de entidades.',
      };
    }

    // Convert documents to supported formats
    const convertedDocuments = await convertDocumentsToSupportedFormats(
      validatedData.data.documents
    );

    const documentsForFlow = convertedDocuments.map(doc => ({
      url: doc.dataUri,
    }));

    const result = await extractEntitiesFromDocuments({
      documents: documentsForFlow,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error extracting entities:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao extrair entidades.';
    return { success: false, error: errorMessage };
  }
}

// Helper to get data URI from File
async function fileToDataUri(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  return `data:${file.type};base64,${base64}`;
}

const analyzeConsistencySchema = z.object({
  systemPrompt: z.string(),
  // We validate structure after processing FormData, or just validate raw input manually
});

export async function handleAnalyzeDocumentConsistency(formData: FormData) {
  try {
    const systemPrompt = formData.get('systemPrompt') as string;
    const files = formData.getAll('documents') as File[];

    if (!systemPrompt) {
      return { success: false, error: 'Prompt do sistema é obrigatório.' };
    }

    if (files.length < 2) {
      return { success: false, error: 'Ao menos dois documentos são necessários para análise de consistência.' };
    }

    // Convert Files to Data URIs on the server using optimized buffer flow
    const documentsForFlow = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = file.type; // or detect from filename if empty
        const dataUri = await convertBufferToSupportedDataUri(buffer, mimeType, file.name);
        return { url: dataUri };
      })
    );

    const result = await analyzeDocumentConsistency({
      systemPrompt,
      documents: documentsForFlow,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error analyzing document consistency:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Falha ao analisar a consistência dos documentos.';
    return { success: false, error: errorMessage };
  }
}
