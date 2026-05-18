'use server';

import { createComposioClient } from '@/lib/composio-client';
import { inspectTemplateForGeneration, generateContractDoc } from './composio-actions';
import { db } from '@/lib/firebase-server';
import { debugLog, debugError, generateRequestId } from '@/lib/utils/request-id';
import type { TemplateSourceField } from '@/lib/template-source';

export type GenerationStepInput = {
  userId: string;
  projectId: string;
  templateId: string;
  step: 'copy' | 'customize' | 'open';
  documentId?: string;
  templateName?: string;
  googleDocLink?: string;
  projectDocLink?: string;
};

export type GenerationStepResult = {
  success: boolean;
  documentId?: string;
  documentLink?: string;
  fileName?: string;
  fieldsFilled?: number;
  error?: string;
  requestId: string;
};

export async function generateContractGenerationStep(
  input: GenerationStepInput
): Promise<GenerationStepResult> {
  const requestId = generateRequestId();
  debugLog(requestId, 'generateContractGenerationStep', 'Starting step', {
    userId: input.userId,
    step: input.step,
  });

  try {
    if (input.step === 'copy') {
      return await handleCopyStep(input, requestId);
    } else if (input.step === 'customize') {
      return await handleCustomizeStep(input, requestId);
    } else {
      return await handleOpenStep(input, requestId);
    }
  } catch (error) {
    debugError(requestId, 'generateContractGenerationStep', 'Unhandled error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      requestId,
    };
  }
}

async function handleCopyStep(
  input: GenerationStepInput,
  requestId: string
): Promise<GenerationStepResult> {
  const inspection = await inspectTemplateForGeneration(input.userId, {
    templateId: input.templateId,
    templateName: input.templateName,
    googleDocLink: input.googleDocLink,
    projectDocLink: input.projectDocLink,
  });

  if (!inspection.success || !inspection.fileId) {
    return {
      success: false,
      error: 'error' in inspection ? inspection.error : 'Falha ao inspecionar o modelo.',
      requestId,
    };
  }

  const projectDoc = await db.collection('projects').doc(input.projectId).get();
  const projectName = projectDoc.exists ? projectDoc.data()?.name : 'Cliente';

  const generation = await generateContractDoc(input.userId, {
    templateId: input.templateId,
    templateName: inspection.templateName,
    googleDocLink: input.googleDocLink,
    projectDocLink: input.projectDocLink,
    preferredSource: inspection.resolvedSource as TemplateSourceField,
    clientName: projectName,
    confirmedPlaceholders: {},
    placeholderMatches: {},
    projectId: input.projectId,
    enrichWithAI: false,
  });

  if (!generation.success || !generation.documentId) {
    return {
      success: false,
      error: 'error' in generation ? generation.error : 'Falha ao copiar o documento.',
      requestId,
    };
  }

  return {
    success: true,
    documentId: generation.documentId,
    documentLink: generation.documentLink,
    fileName: generation.fileName,
    requestId,
  };
}

async function handleCustomizeStep(
  input: GenerationStepInput,
  requestId: string
): Promise<GenerationStepResult> {
  if (!input.documentId) {
    return { success: false, error: 'documentId is required', requestId };
  }

  const client = await createComposioClient(input.userId);
  const placeholders = await client.getDocumentPlaceholders(input.documentId);

  if (placeholders.length === 0) {
    return {
      success: true,
      documentId: input.documentId,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      fieldsFilled: 0,
      requestId,
    };
  }

  const projectDocsSnapshot = await db.collection('projectDocuments')
    .where('projectId', '==', input.projectId)
    .where('status', '==', 'indexed')
    .get();

  const entityData: Record<string, unknown> = {};
  for (const docSnap of projectDocsSnapshot.docs) {
    const data = docSnap.data();
    entityData[data.name || docSnap.id] = {
      documentType: data.documentType,
      fileType: data.fileType,
      fileUrl: data.fileUrl,
    };
  }

  const { aiEnrichContract } = await import('@/ai/flows/ai-enrich-contract');

  const enrichmentResult = await aiEnrichContract({
    userId: input.userId,
    documentId: input.documentId,
    templateId: input.templateId,
    placeholders: placeholders.map((p) => p.key),
    entityData,
    context: `Projeto: ${input.projectId}`,
    contractType: input.templateId,
  });

  if (enrichmentResult.success) {
    return {
      success: true,
      documentId: input.documentId,
      documentLink: enrichmentResult.documentLink,
      fieldsFilled: enrichmentResult.substitutions.length,
      requestId,
    };
  }

  return {
    success: true,
    documentId: input.documentId,
    documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
    fieldsFilled: 0,
    requestId,
  };
}

async function handleOpenStep(
  input: GenerationStepInput,
  requestId: string
): Promise<GenerationStepResult> {
  if (!input.documentId) {
    return { success: false, error: 'documentId is required', requestId };
  }

  return {
    success: true,
    documentId: input.documentId,
    documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
    requestId,
  };
}
