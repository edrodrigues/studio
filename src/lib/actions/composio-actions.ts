'use server';

import { aiEnrichContract } from '@/ai/flows/ai-enrich-contract';
import { aiReviewContract, type ReviewEditSuggestion } from '@/ai/flows/ai-review-contract';
import {
  auditTemplateLinks,
  isFallbackEligibleErrorType,
  type TemplateSourceAudit,
  type TemplateSourceDiagnostic,
  type TemplateSourceField,
} from '@/lib/template-source';
import { createComposioClient, type ComposioClient, type ConnectionStatus } from '@/lib/composio-client';
import { db } from '@/lib/firebase-server';
import {
  getErrorType,
  cloneSourceDiagnostics,
  createTemplateActionError,
  buildValidationError,
  updateSourceFailure,
  getSourceAttemptOrder,
  buildUserFriendlyError,
  mergePlaceholderDefinitions,
  buildReplacementRequests,
  type PlaceholderDefinition,
  type TemplateErrorType,
  type TemplateSourceDiagnostics,
  type TemplateActionError,
} from './shared-docs-actions';

type TemplateSourceInput = {
  templateId?: string;
  templateName?: string;
  googleDocLink?: string;
  projectDocLink?: string;
  fallbackMarkdownContent?: string;
};

type ResolveTemplateSourceOptions = {
  preferredSource?: TemplateSourceField;
};

type ResolvedTemplateSource = {
  fileId: string;
  templateName: string;
  resolvedSource: TemplateSourceField;
  fallbackUsed: boolean;
  sourceDiagnostics: TemplateSourceDiagnostics;
  warnings: string[];
};

type DeterministicGenerationResult = {
  documentLink: string;
  replacementsApplied: number;
};

// ============================================================
// AI ENRICHMENT ACTION
// ============================================================

export type AIEnrichmentInput = {
  documentId: string;
  templateId: string;
  placeholders: string[];
  entityData: Record<string, unknown>;
  context?: string;
  contractType?: string;
};

export async function enrichContractWithAI(
  userId: string,
  input: AIEnrichmentInput
): Promise<{
  success: boolean;
  documentLink: string;
  substitutions: Array<{ placeholder: string; value: string; source: string; confidence?: string }>;
  unfilled: string[];
  error?: string;
}> {
  try {
    await requireComposioConnection(userId);

    const result = await aiEnrichContract({
      userId,
      ...input,
    });

    return result;
  } catch (error) {
    console.error('Error in enrichContractWithAI Server Action:', error);
    return {
      success: false,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      substitutions: [],
      unfilled: input.placeholders,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper functions (getErrorType, cloneSourceDiagnostics, createTemplateActionError,
// buildValidationError, updateSourceFailure, getSourceAttemptOrder) are imported from shared-docs-actions.ts

/**
 * Checks Composio connection status before operations
 * Returns true if connected, false otherwise
 */
async function checkComposioConnection(userId: string): Promise<{ connected: boolean; status: ConnectionStatus }> {
  try {
    const client = await createComposioClient(userId);
    return await client.checkConnection(userId);
  } catch {
    return { connected: false, status: 'FAILED' };
  }
}

/**
 * Throws AUTH_EXPIRED if user is not connected to Composio
 */
async function requireComposioConnection(userId: string): Promise<void> {
  const { connected, status } = await checkComposioConnection(userId);
  if (!connected) {
    const error = createTemplateActionError(
      'AUTH_EXPIRED',
      'Sua conta Google não está conectada ao sistema de geração. Conecte sua conta Google nas configurações.'
    );
    throw error;
  }
}

async function validateTemplateSource(
  client: ComposioClient,
  userId: string,
  field: TemplateSourceField,
  sourceDiagnostics: TemplateSourceDiagnostics
) {
  const source = sourceDiagnostics[field];

  if (source.status !== 'available' || !source.fileId) {
    throw buildValidationError(
      field,
      sourceDiagnostics,
      source.message || `O ${source.label} não está pronto para uso.`
    );
  }

  const metadata = await client.getFileMetadata(source.fileId);
  sourceDiagnostics[field] = {
    ...sourceDiagnostics[field],
    fileName: metadata.name,
    mimeType: metadata.mimeType,
  };

  if (metadata.mimeType !== 'application/vnd.google-apps.document') {
    throw createTemplateActionError(
      'INVALID_TEMPLATE_TYPE',
      `O ${source.label} aponta para "${metadata.name}", que tem tipo "${metadata.mimeType}" em vez de um Google Docs editável.`,
      {
        failedSource: field,
        sourceDiagnostics,
      }
    );
  }

  return metadata;
}

async function resolveTemplateSource(
  userId: string,
  input: TemplateSourceInput,
  options: ResolveTemplateSourceOptions = {}
): Promise<ResolvedTemplateSource> {
  // Check Composio connection first
  await requireComposioConnection(userId);
  const client = await createComposioClient(userId);

  const audit = auditTemplateLinks(input.googleDocLink, input.projectDocLink);
  const sourceDiagnostics = cloneSourceDiagnostics(audit);

  if (sourceDiagnostics.googleDocLink.status === 'invalid_format') {
    throw buildValidationError(
      'googleDocLink',
      sourceDiagnostics,
      'O link original do modelo está inválido. Corrija esse campo antes de gerar.'
    );
  }

  if (sourceDiagnostics.projectDocLink.status === 'invalid_format') {
    sourceDiagnostics.projectDocLink.message =
      'O link customizado do projeto está inválido e não pode ser usado como fallback.';
  }

  const attemptOrder = getSourceAttemptOrder(sourceDiagnostics, options.preferredSource);
  const warnings: string[] = [];
  let primaryFailure: TemplateActionError | null = null;
  const preferredProjectFallback =
    options.preferredSource === 'projectDocLink' &&
    sourceDiagnostics.googleDocLink.status === 'available';

  for (const field of attemptOrder) {
    const source = sourceDiagnostics[field];
    const isOriginal = field === 'googleDocLink';

    if (source.status === 'missing') {
      if (isOriginal) {
        continue;
      }
      break;
    }

    if (source.status !== 'available') {
      if (isOriginal) {
        throw buildValidationError(
          field,
          sourceDiagnostics,
          source.message || 'O link original do modelo está inválido.'
        );
      }
      continue;
    }

    try {
      const metadata = await validateTemplateSource(client, userId, field, sourceDiagnostics);
      const fallbackUsed =
        field === 'projectDocLink' && (Boolean(primaryFailure) || preferredProjectFallback);

      if (fallbackUsed) {
        warnings.push(
          'O link original ficou indisponível e a geração passou a usar a versão customizada do projeto.'
        );
      } else if (field === 'projectDocLink' && sourceDiagnostics.googleDocLink.status === 'missing') {
        warnings.push(
          'A geração está usando apenas a versão customizada do projeto porque o link original não foi preenchido.'
        );
      }

      console.info('[TemplateSource] Resolved template source', {
        templateId: input.templateId,
        templateName: input.templateName,
        resolvedSource: field,
        fallbackUsed,
        failedSource: primaryFailure?.failedSource,
        googleDocId: sourceDiagnostics.googleDocLink.fileId,
        projectDocId: sourceDiagnostics.projectDocLink.fileId,
      });

      return {
        fileId: metadata.id,
        templateName: metadata.name,
        resolvedSource: field,
        fallbackUsed,
        sourceDiagnostics,
        warnings,
      };
    } catch (error) {
      const typedError =
        error instanceof Error
          ? (error as TemplateActionError)
          : createTemplateActionError(getErrorType(error), String(error ?? 'Unknown error'));

      updateSourceFailure(sourceDiagnostics, field, typedError);

      console.warn('[TemplateSource] Template source failed', {
        templateId: input.templateId,
        templateName: input.templateName,
        failedSource: field,
        errorType: getErrorType(typedError),
        googleDocId: sourceDiagnostics.googleDocLink.fileId,
        projectDocId: sourceDiagnostics.projectDocLink.fileId,
      });

      if (field === 'googleDocLink' && isFallbackEligibleErrorType(getErrorType(typedError))) {
        primaryFailure = {
          ...typedError,
          failedSource: 'googleDocLink',
          sourceDiagnostics,
        };
        continue;
      }

      throw createTemplateActionError(
        getErrorType(typedError),
        typedError.technicalDetails || typedError.message,
        {
          failedSource: field,
          sourceDiagnostics,
        }
      );
    }
  }

  if (primaryFailure && sourceDiagnostics.projectDocLink.status === 'missing') {
    throw createTemplateActionError(
      getErrorType(primaryFailure),
      primaryFailure.technicalDetails || primaryFailure.message,
      {
        failedSource: 'googleDocLink',
        sourceDiagnostics,
      }
    );
  }

  throw createTemplateActionError(
    'INVALID_REQUEST',
    'Nenhum link de template utilizável foi encontrado.',
    {
      failedSource:
        sourceDiagnostics.googleDocLink.status !== 'missing' ? 'googleDocLink' : 'projectDocLink',
      sourceDiagnostics,
    }
  );
}

// buildUserFriendlyError, mergePlaceholderDefinitions, and buildReplacementRequests
// are imported from shared-docs-actions.ts

async function generateContractInDocsWithComposio(
  client: ComposioClient,
  documentId: string,
  placeholderValues: Record<string, string>,
  placeholderMatches: Record<string, string[]>
): Promise<DeterministicGenerationResult> {
  const requests = buildReplacementRequests(placeholderValues, placeholderMatches);

  if (requests.length > 0) {
    await client.batchUpdateDocument(documentId, requests);
  }

  return {
    documentLink: `https://docs.google.com/document/d/${documentId}/edit`,
    replacementsApplied: requests.length,
  };
}

export async function inspectTemplateForGeneration(
  userId: string,
  input: TemplateSourceInput
) {
  try {
    const resolved = await resolveTemplateSource(userId, input);
    const client = await createComposioClient(userId);
    const googleDocPlaceholders = await client.getDocumentPlaceholders(resolved.fileId);
    const placeholders = mergePlaceholderDefinitions(
      googleDocPlaceholders,
      input.fallbackMarkdownContent
    );

    return {
      success: true,
      fileId: resolved.fileId,
      templateName: resolved.templateName,
      placeholders,
      resolvedSource: resolved.resolvedSource,
      fallbackUsed: resolved.fallbackUsed,
      sourceDiagnostics: resolved.sourceDiagnostics,
      warnings: resolved.warnings,
    };
  } catch (error) {
    console.error('Error inspecting Google Doc template:', error);
    return {
      success: false,
      ...buildUserFriendlyError(error),
    };
  }
}

export async function generateContractDoc(
  userId: string,
  input: TemplateSourceInput & {
    preferredSource?: TemplateSourceField;
    clientName: string;
    confirmedPlaceholders: Record<string, string>;
    placeholderMatches: Record<string, string[]>;
    projectId?: string;
    enrichWithAI?: boolean;
    entityData?: Record<string, unknown>;
  }
) {
  try {
    const resolved = await resolveTemplateSource(userId, input, {
      preferredSource: input.preferredSource,
    });

    console.log('[TemplateGeneration] Starting Google Doc generation', {
      templateId: input.templateId,
      templateName: input.templateName,
      resolvedSource: resolved.resolvedSource,
      fallbackUsed: resolved.fallbackUsed,
      googleDocId: resolved.sourceDiagnostics.googleDocLink.fileId,
      projectDocId: resolved.sourceDiagnostics.projectDocLink.fileId,
      enrichWithAI: input.enrichWithAI,
    });

    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const newFileName = `Contrato - ${input.templateName || resolved.templateName} - ${input.clientName} - ${dateStr}`;

    // Use Composio copyFile (via composio-client adapter)
    const client = await createComposioClient(userId);
    const newFileId = await client.copyFile(resolved.fileId, newFileName);

    console.log('[TemplateGeneration] Successfully copied template', {
      templateId: input.templateId,
      templateName: input.templateName,
      resolvedSource: resolved.resolvedSource,
      newFileId,
    });

    let aiEnriched = false;
    let result: { documentLink: string; replacementsApplied: number };

    // AI ENRICHMENT PATH: use Gemini to infer placeholder values from entity data
    if (input.enrichWithAI && input.entityData) {
      console.log('[TemplateGeneration] AI enrichment enabled — calling aiEnrichContract');
      const enrichmentResult = await aiEnrichContract({
        userId,
        documentId: newFileId,
        templateId: input.templateId || '',
        placeholders: Object.keys(input.placeholderMatches),
        entityData: input.entityData,
        context: input.templateName,
        contractType: input.templateName,
      });

      if (enrichmentResult.success) {
        aiEnriched = true;
        result = {
          documentLink: enrichmentResult.documentLink,
          replacementsApplied: enrichmentResult.substitutions.length,
        };
        console.log('[TemplateGeneration] AI enrichment succeeded', {
          substitutionsApplied: enrichmentResult.substitutions.length,
          unfilled: enrichmentResult.unfilled,
        });
      } else {
        console.warn('[TemplateGeneration] AI enrichment failed, falling back to deterministic', {
          error: enrichmentResult.error,
        });
        result = await generateContractInDocsWithComposio(
          client,
          newFileId,
          input.confirmedPlaceholders,
          input.placeholderMatches
        );
      }
    } else {
      result = await generateContractInDocsWithComposio(
        client,
        newFileId,
        input.confirmedPlaceholders,
        input.placeholderMatches
      );
    }

    console.log('[TemplateGeneration] Placeholder replacement completed', {
      templateId: input.templateId,
      templateName: input.templateName,
      resolvedSource: resolved.resolvedSource,
      replacementsApplied: result.replacementsApplied,
      aiEnriched,
    });

    return {
      success: true,
      documentId: newFileId,
      documentLink: result.documentLink,
      replacementsApplied: result.replacementsApplied,
      fileName: newFileName,
      resolvedSource: resolved.resolvedSource,
      fallbackUsed: resolved.fallbackUsed,
      sourceDiagnostics: resolved.sourceDiagnostics,
      warnings: resolved.warnings,
      aiEnriched,
    };
  } catch (error) {
    console.error('Error in generateContractDoc Server Action:', error);
    return {
      success: false,
      ...buildUserFriendlyError(error),
    };
  }
}

// ============================================================
// AI REVIEW ACTIONS
// ============================================================

export type AIReviewInput = {
  documentId: string;
  documentName?: string;
  context?: string;
  reviewFocus?: 'all' | 'legal' | 'completeness' | 'consistency';
  contractType?: string;
};

/**
 * Reviews a generated contract using AI (Gemini) and returns structured edit suggestions.
 * Does NOT auto-apply — returns suggestions only for user review.
 */
export async function reviewContractWithAI(
  userId: string,
  input: AIReviewInput
): Promise<{
  success: boolean;
  documentId: string;
  summary: string;
  overallQuality: 'good' | 'needs_work' | 'requires_revision';
  suggestions: ReviewEditSuggestion[];
  reviewedAt: string;
  error?: string;
}> {
  try {
    await requireComposioConnection(userId);

    const result = await aiReviewContract({
      userId,
      documentId: input.documentId,
      documentName: input.documentName,
      context: input.context,
      reviewFocus: input.reviewFocus || 'all',
      contractType: input.contractType,
    });

    return result;
  } catch (error) {
    console.error('Error in reviewContractWithAI Server Action:', error);
    return {
      success: false,
      documentId: input.documentId,
      summary: '',
      overallQuality: 'requires_revision',
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type ApplyReviewEditsInput = {
  documentId: string;
  contractId?: string; // Firestore contract ID for storing edits for undo
  edits: ReviewEditSuggestion[];
};

/**
 * Applies selected AI review edits to a Google Doc via Composio.
 * User must confirm edits before this is called.
 * Stores edits in Firestore for potential undo.
 */
export async function applyReviewEdits(
  userId: string,
  input: ApplyReviewEditsInput
): Promise<{ success: boolean; editsApplied: number; documentLink: string; error?: string }> {
  try {
    await requireComposioConnection(userId);

    if (!input.edits || input.edits.length === 0) {
      return {
        success: true,
        editsApplied: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      };
    }

    // Build batch update requests from edits
    const requests = input.edits
      .filter((edit) => edit.originalText && edit.suggestedText)
      .map((edit) => ({
        replaceAllText: {
          replaceText: edit.suggestedText,
          containsText: {
            text: edit.originalText,
            matchCase: false,
          },
        },
      }));

    if (requests.length === 0) {
      return {
        success: true,
        editsApplied: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      };
    }

    const client = await createComposioClient(userId);
    await client.batchUpdateDocument(input.documentId, requests);

    console.log('[applyReviewEdits] Applied edits via Composio', {
      documentId: input.documentId,
      editsApplied: requests.length,
    });

    // Store edits in Firestore for undo (if contractId provided)
    if (input.contractId) {
      try {
        await db.collection('projectContracts').doc(input.contractId).update({
          lastReviewEdits: {
            appliedAt: new Date().toISOString(),
            edits: input.edits.map((e) => ({
              section: e.section,
              originalText: e.originalText,
              suggestedText: e.suggestedText,
              reason: e.reason,
              severity: e.severity,
              confidence: e.confidence,
            })),
          },
        });
      } catch (firestoreError) {
        // Non-fatal: log but don't fail the operation
        console.warn('[applyReviewEdits] Failed to store edits in Firestore:', firestoreError);
      }
    }

    return {
      success: true,
      editsApplied: requests.length,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
    };
  } catch (error) {
    console.error('Error in applyReviewEdits Server Action:', error);
    return {
      success: false,
      editsApplied: 0,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type RevertReviewEditsInput = {
  documentId: string;
  contractId?: string; // Firestore contract ID for clearing stored edits after revert
  edits: ReviewEditSuggestion[];
};

/**
 * Reverts applied AI review edits from a Google Doc via Composio.
 * Reverses the originalText → suggestedText replacements.
 * Clears stored edits from Firestore after revert.
 */
export async function revertReviewEdits(
  userId: string,
  input: RevertReviewEditsInput
): Promise<{ success: boolean; editsReverted: number; documentLink: string; error?: string }> {
  try {
    await requireComposioConnection(userId);

    if (!input.edits || input.edits.length === 0) {
      return {
        success: true,
        editsReverted: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      };
    }

    // Build batch update requests to revert: suggestedText → originalText
    const requests = input.edits
      .filter((edit) => edit.originalText && edit.suggestedText)
      .map((edit) => ({
        replaceAllText: {
          replaceText: edit.originalText,
          containsText: {
            text: edit.suggestedText,
            matchCase: false,
          },
        },
      }));

    if (requests.length === 0) {
      return {
        success: true,
        editsReverted: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      };
    }

    const client = await createComposioClient(userId);
    await client.batchUpdateDocument(input.documentId, requests);

    console.log('[revertReviewEdits] Reverted edits via Composio', {
      documentId: input.documentId,
      editsReverted: requests.length,
    });

    // Clear stored edits from Firestore after successful revert
    if (input.contractId) {
      try {
        await db.collection('projectContracts').doc(input.contractId).update({
          lastReviewEdits: null,
        });
      } catch (firestoreError) {
        // Non-fatal: log but don't fail the operation
        console.warn('[revertReviewEdits] Failed to clear edits from Firestore:', firestoreError);
      }
    }

    return {
      success: true,
      editsReverted: requests.length,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
    };
  } catch (error) {
    console.error('Error in revertReviewEdits Server Action:', error);
    return {
      success: false,
      editsReverted: 0,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
