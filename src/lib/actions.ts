
'use server';
import 'dotenv/config';

import { generateContractFromDocuments } from '@/ai/flows/generate-contract-from-documents';
import { getAssistanceFromGemini } from '@/ai/flows/get-assistance-from-gemini';
import { getDocumentFeedback } from '@/ai/flows/get-document-feedback';
import { extractEntitiesFromDocuments } from '@/ai/flows/extract-entities-from-documents';
import { analyzeDocumentConsistency } from '@/ai/flows/analyze-document-consistency';
import { getPlaybookAssistance } from '@/ai/flows/get-playbook-assistance';
import { convertDocumentsToSupportedFormats, convertBufferToSupportedDataUri } from '@/lib/document-converter';
import { db } from '@/lib/firebase-server';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ProjectDocument, ProjectRole } from './types';
import { getDownloadUrl } from './actions/storage-actions';
import { z } from 'zod';

const fileSchema = z.string().refine(s => s.startsWith('data:'), {
  message: 'File must be a data URI',
});

const fileObjectSchema = z.object({
  name: z.string(),
  dataUri: fileSchema,
});

const extractEntitiesSchema = z.object({
  projectId: z.string().optional(),
  userId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  documents: z.array(fileObjectSchema).optional(),
});

/**
 * Helper to prepare documents for AI flows, supporting both R2 and Firebase.
 * Converts non-supported formats (DOCX, XLSX) to text and provides URLs for others.
 */
async function prepareDocumentsForFlow(input: {
  projectId?: string;
  userId?: string;
  documentIds?: string[];
  documents?: { name: string; dataUri: string }[];
}): Promise<{ url: string }[]> {
  if (input.documentIds && input.projectId && input.userId) {
    const documentsSnapshot = await Promise.all(
      input.documentIds.map(id => db.collection('projectDocuments').doc(id).get())
    );

    return await Promise.all(
      documentsSnapshot.map(async (docSnap) => {
        if (!docSnap.exists) {
          throw new Error(`Documento ${docSnap.id} não encontrado.`);
        }
        const docData = docSnap.data() as ProjectDocument;

        // Fetch the file buffer first
        let buffer: Buffer;
        if (docData.storageProvider === 'r2') {
          const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: docData.storagePath,
          });
          const response = await r2Client.send(command);
          if (!response.Body) {
            throw new Error(`Arquivo vazio ou não encontrado: ${docData.name}`);
          }
          buffer = Buffer.from(await response.Body.transformToByteArray());
        } else {
          const response = await fetch(docData.fileUrl);
          if (!response.ok) throw new Error(`Falha ao baixar arquivo ${docData.name}`);
          buffer = Buffer.from(await response.arrayBuffer());
        }

        // Convert all file types to text to avoid image processing issues with AI
        const dataUri = await convertBufferToSupportedDataUri(
          buffer,
          docData.mimeType,
          docData.originalFileName
        );
        return { url: dataUri };
      })
    );
  } else if (input.documents) {
    const convertedDocuments = await convertDocumentsToSupportedFormats(input.documents);
    return convertedDocuments.map(doc => ({ url: doc.dataUri }));
  }

  return [];
}

const generateContractSchema = z.object({
  projectId: z.string().optional(),
  userId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  documents: z.array(fileObjectSchema).optional(),
});

export async function handleGenerateContract(input: {
  projectId?: string;
  userId?: string;
  documentIds?: string[];
  documents?: { name: string; dataUri: string }[];
}) {
  try {
    console.log('handleGenerateContract: Starting validation');
    const validatedData = generateContractSchema.safeParse(input);

    if (!validatedData.success) {
      console.error('handleGenerateContract: Validation failed', validatedData.error.flatten());
      return { success: false, error: 'Dados de arquivo inválidos.' };
    }

    console.log('handleGenerateContract: Preparing documents');
    const documentsForFlow = await prepareDocumentsForFlow(validatedData.data);

    if (documentsForFlow.length === 0) {
      console.warn('handleGenerateContract: No documents provided');
      return { success: false, error: 'Nenhum documento fornecido para geração.' };
    }

    console.log(`handleGenerateContract: Calling generateContractFromDocuments with ${documentsForFlow.length} docs`);
    const result = await generateContractFromDocuments({
      documents: documentsForFlow,
    });
    
    console.log('handleGenerateContract: Generation successful');
    return { success: true, data: result };
  } catch (error) {
    console.error('handleGenerateContract: CRITICAL ERROR', error);
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

const getPlaybookChatSchema = z.object({
  query: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional(),
  projectId: z.string().optional(),
});

export async function handleGetPlaybookAssistance(input: {
  query: string;
  history?: { role: 'user' | 'model'; content: string }[];
  projectId?: string;
}) {
  try {
    const validatedData = getPlaybookChatSchema.safeParse(input);
    if (!validatedData.success) {
      return { success: false, error: 'Dados de entrada inválidos.' };
    }
    const result = await getPlaybookAssistance(validatedData.data);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting playbook assistance:', error);
    return { success: false, error: 'Falha ao obter resposta do Playbook.' };
  }
}

const saveFeedbackSchema = z.object({
  query: z.string(),
  answer: z.string(),
  feedback: z.enum(['positive', 'neutral', 'negative']),
  userId: z.string().optional(),
  userName: z.string().optional(),
});

export async function handleSavePlaybookFeedback(input: {
  query: string;
  answer: string;
  feedback: 'positive' | 'neutral' | 'negative';
  userId?: string;
  userName?: string;
}) {
  try {
    const validatedData = saveFeedbackSchema.safeParse(input);
    if (!validatedData.success) {
      return { success: false, error: 'Dados de feedback inválidos.' };
    }

    await db.collection('playbook_feedback').add({
      ...validatedData.data,
      status: 'Em análise',
      timestamp: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving feedback:', error);
    return { success: false, error: 'Falha ao salvar o feedback.' };
  }
}

const saveDeveloperFeedbackSchema = z.object({
  message: z.string().min(1, "A mensagem não pode estar vazia"),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string().email().optional(),
});

export async function handleSaveDeveloperFeedback(input: {
  message: string;
  userId: string;
  userName: string;
  userEmail?: string;
}) {
  try {
    const validatedData = saveDeveloperFeedbackSchema.safeParse(input);
    if (!validatedData.success) {
      return { success: false, error: 'Dados de entrada inválidos.' };
    }

    await db.collection('developer_feedback').add({
      ...validatedData.data,
      status: 'Em análise',
      timestamp: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error('SERVER ACTION ERROR (Developer Feedback):', error);
    return { success: false, error: 'Falha ao salvar o feedback do desenvolvedor.' };
  }
}

export async function handleGetAlexFeedback() {
  try {
    const snapshot = await db.collection('playbook_feedback')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const feedbacks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp?.toISOString?.() || new Date().toISOString(),
    }));
    return { success: true, data: feedbacks };
  } catch (error) {
    console.error('Error getting alex feedback:', error);
    return { success: false, error: 'Falha ao carregar feedbacks do Alex.' };
  }
}



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
  projectId: z.string().optional(),
  userId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  documents: z.array(fileObjectSchema).optional(),
});

export async function handleGetFeedback(input: {
  systemPrompt: string;
  projectId?: string;
  userId?: string;
  documentIds?: string[];
  documents?: { name: string; dataUri: string }[];
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

    const documentsForFlow = await prepareDocumentsForFlow(validatedData.data);

    if (documentsForFlow.length === 0) {
      return { success: false, error: 'Nenhum documento fornecido para feedback.' };
    }

    // Inject Playbook Content
    let systemPromptToUse = validatedData.data.systemPrompt;
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const playbookPath = path.join(process.cwd(), 'docs', 'Playbook - Contratos V-LAB.md');

      if (fs.existsSync(playbookPath)) {
        const playbookContent = fs.readFileSync(playbookPath, 'utf-8');
        systemPromptToUse = `${systemPromptToUse}\n\n### REFERÊNCIA OBRIGATÓRIA (PLAYBOOK DE CONTRATOS):\nUse as diretrizes abaixo para avaliar os documentos. Se houver divergência entre o conhecimento geral e este playbook, siga o playbook.\n\n${playbookContent}`;
      }
    } catch (error) {
      console.error('Error reading playbook:', error);
    }

    const result = await getDocumentFeedback({
      systemPrompt: systemPromptToUse,
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

import { uploadFileToProjectStore } from './google-ai-stores';

const syncToFileSearchSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  documentIds: z.array(z.string()),
});

export async function handleSyncToFileSearch(input: {
  projectId: string;
  userId: string;
  documentIds: string[];
}) {
  try {
    const validatedData = syncToFileSearchSchema.safeParse(input);
    if (!validatedData.success) {
      return { success: false, error: 'Dados de entrada inválidos para sincronização.' };
    }

    const { projectId, documentIds } = validatedData.data;

    // Fetch documents from DB to get their buffers
    const documentsSnapshot = await Promise.all(
      documentIds.map(id => db.collection('projectDocuments').doc(id).get())
    );

    const syncResults = await Promise.all(
      documentsSnapshot.map(async (docSnap) => {
        if (!docSnap.exists) return null;
        const docData = docSnap.data() as ProjectDocument;
        
        let buffer: Buffer;
        if (docData.storageProvider === 'r2') {
          const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: docData.storagePath,
          });
          const response = await r2Client.send(command);
          if (!response.Body) return null;
          buffer = Buffer.from(await response.Body.transformToByteArray());
        } else {
          const response = await fetch(docData.fileUrl);
          if (!response.ok) return null;
          buffer = Buffer.from(await response.arrayBuffer());
        }

        // Sincronizar com o File Search do Google
        return await uploadFileToProjectStore(
          projectId, 
          buffer, 
          docData.name, 
          docData.mimeType
        );
      })
    );

    // After syncing, mark project as synced to enable File Search for ALEX
    await db.collection('projects').doc(projectId).update({
      isSyncedToFileSearch: true,
      lastSyncedAt: new Date()
    });

    return { success: true, results: syncResults };
  } catch (error) {
    console.error('Error syncing to file search:', error);
    return { success: false, error: 'Falha ao sincronizar com o File Search.' };
  }
}

export interface DocumentIndexingStatus {
  isSynced: boolean;
  storeId: string | null;
  lastSyncedAt: Date | string | null;
}

export async function checkDocumentIndexingStatus(projectId: string): Promise<DocumentIndexingStatus> {
  try {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    const data = projectDoc.data();
    
    return {
      isSynced: data?.isSyncedToFileSearch || false,
      storeId: data?.fileSearchStoreId || null,
      lastSyncedAt: data?.lastSyncedAt || null,
    };
  } catch (error) {
    console.error('Error checking document indexing status:', error);
    return {
      isSynced: false,
      storeId: null,
      lastSyncedAt: null,
    };
  }
}

export async function handleExtractEntitiesAction(input: {
  projectId?: string;
  userId?: string;
  documentIds?: string[];
  documents?: { name: string; dataUri: string }[];
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

    const documentsForFlow = await prepareDocumentsForFlow(validatedData.data);

    if (documentsForFlow.length === 0) {
      return { success: false, error: 'Nenhum documento fornecido para extração.' };
    }

    const result = await extractEntitiesFromDocuments({
      documents: documentsForFlow,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error extracting entities:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Falha ao sincronizar arquivos.';
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
    const documentIds = formData.getAll('documentIds') as string[];
    const files = formData.getAll('documents') as File[];
    const projectId = formData.get('projectId') as string;
    const userId = formData.get('userId') as string;

    if (!systemPrompt) {
      return { success: false, error: 'Prompt do sistema é obrigatório.' };
    }

    let documentsForFlow: { url: string }[] = [];

    if (documentIds.length > 0 && projectId && userId) {
      documentsForFlow = await prepareDocumentsForFlow({
        projectId,
        userId,
        documentIds
      });
    } else if (files.length > 0) {
      // Convert Files to Data URIs on the server using optimized buffer flow
      documentsForFlow = await Promise.all(
        files.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = file.type;
          const dataUri = await convertBufferToSupportedDataUri(buffer, mimeType, file.name);
          return { url: dataUri };
        })
      );
    }

    if (documentsForFlow.length < 2) {
      return { success: false, error: 'Ao menos dois documentos são necessários para análise de consistência.' };
    }

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
