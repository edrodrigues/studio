'use server';
import 'dotenv/config';

import {generateContractFromDocuments} from '@/ai/flows/generate-contract-from-documents';
import {getAssistanceFromGemini} from '@/ai/flows/get-assistance-from-gemini';
import {getDocumentFeedback} from '@/ai/flows/get-document-feedback';
import {extractEntitiesFromDocuments} from '@/ai/flows/extract-entities-from-documents';
import {z} from 'zod';

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
  documents: {name: string; dataUri: string}[];
}) {
  try {
    const validatedData = generateContractSchema.safeParse(input);

    if (!validatedData.success) {
      console.error('Validation failed', validatedData.error.flatten());
      return {success: false, error: 'Dados de arquivo inválidos.'};
    }

    const documentsForFlow = validatedData.data.documents.map(doc => ({
      url: doc.dataUri,
    }));

    const result = await generateContractFromDocuments({
      documents: documentsForFlow,
    });
    return {success: true, data: result};
  } catch (error) {
    console.error('Error generating contract:', error);
    return {success: false, error: 'Falha ao gerar o contrato.'};
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
      return {success: false, error: 'Dados de entrada inválidos.'};
    }
    const result = await getAssistanceFromGemini(validatedData.data);
    return {success: true, data: result};
  } catch (error) {
    console.error('Error getting assistance:', error);
    return {success: false, error: 'Falha ao obter assistência.'};
  }
}

const getFeedbackSchema = z.object({
  systemPrompt: z.string(),
  documents: z.array(fileObjectSchema),
});

export async function handleGetFeedback(input: {
  systemPrompt: string;
  documents: {name: string; dataUri: string}[];
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

    const documentsForFlow = validatedData.data.documents.map(doc => ({
      url: doc.dataUri,
    }));

    const result = await getDocumentFeedback({
      systemPrompt: validatedData.data.systemPrompt,
      documents: documentsForFlow,
    });

    return {success: true, data: result};
  } catch (error)
 {
    console.error('Error getting feedback:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Falha ao obter feedback da IA.';
    return {success: false, error: errorMessage};
  }
}

const extractEntitiesSchema = z.object({
  documents: z.array(fileObjectSchema),
});

export async function handleExtractEntities(input: {
  documents: {name: string; dataUri: string}[];
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

    const documentsForFlow = validatedData.data.documents.map(doc => ({
      url: doc.dataUri,
    }));

    const result = await extractEntitiesFromDocuments({
      documents: documentsForFlow,
    });

    return {success: true, data: result};
  } catch (error) {
    console.error('Error extracting entities:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao extrair entidades.';
    return {success: false, error: errorMessage};
  }
}
