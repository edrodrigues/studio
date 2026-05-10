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
import { extractGoogleDocId } from '@/lib/utils';
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
import { debugLog, debugError, generateRequestId } from '@/lib/utils/request-id';
import { executeWithRetryAndAuthRefresh } from '@/lib/composio-client';

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
  const requestId = generateRequestId();
  debugLog(requestId, 'enrichContractWithAI', 'Starting enrichment', { userId, documentId: input.documentId, templateId: input.templateId });

  try {
    await requireComposioConnection(userId);

    const result = await aiEnrichContract({
      userId,
      ...input,
    });

    debugLog(requestId, 'enrichContractWithAI', 'Enrichment completed', {
      success: result.success,
      substitutionsCount: result.substitutions?.length,
      unfilledCount: result.unfilled?.length,
      error: result.error,
    });

    return result;
  } catch (error) {
    debugError(requestId, 'enrichContractWithAI', 'Enrichment failed with unhandled error', error, {
      userId,
      documentId: input.documentId,
      templateId: input.templateId,
    });
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
async function requireComposioConnection(userId: string, requestId?: string): Promise<void> {
  const reqId = requestId || generateRequestId();
  const { connected, status } = await checkComposioConnection(userId);
  if (!connected) {
    debugError(reqId, 'requireComposioConnection', 'Connection not active', new Error('AUTH_EXPIRED'), { userId, status });
    const error = createTemplateActionError(
      'AUTH_EXPIRED',
      'Sua conta Google não está conectada ao sistema de geração. Conecte sua conta Google nas configurações.'
    );
    throw error;
  }
  debugLog(reqId, 'requireComposioConnection', 'Connection verified', { userId, status });
}

async function validateTemplateSource(
  client: ComposioClient,
  userId: string,
  field: TemplateSourceField,
  sourceDiagnostics: TemplateSourceDiagnostics,
  requestId: string
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

  debugLog(requestId, 'validateTemplateSource', 'Metadata retrieved', {
    field,
    fileId: source.fileId,
    fileName: metadata.name,
    mimeType: metadata.mimeType,
  });

  if (metadata.mimeType !== 'application/vnd.google-apps.document') {
    debugError(requestId, 'validateTemplateSource', 'Invalid template type', new Error('INVALID_TEMPLATE_TYPE'), {
      field,
      fileId: source.fileId,
      fileName: metadata.name,
      mimeType: metadata.mimeType,
    });
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
  const requestId = generateRequestId();
  debugLog(requestId, 'resolveTemplateSource', 'Starting source resolution', {
    userId,
    templateId: input.templateId,
    templateName: input.templateName,
    googleDocLink: input.googleDocLink ? extractGoogleDocId(input.googleDocLink) : null,
    projectDocLink: input.projectDocLink ? extractGoogleDocId(input.projectDocLink) : null,
    preferredSource: options.preferredSource,
  });

  // Check Composio connection first
  await requireComposioConnection(userId, requestId);
  const client = await createComposioClient(userId);

  const audit = auditTemplateLinks(input.googleDocLink, input.projectDocLink);
  const sourceDiagnostics = cloneSourceDiagnostics(audit);

  if (sourceDiagnostics.googleDocLink.status === 'invalid_format') {
    debugError(requestId, 'resolveTemplateSource', 'Invalid Google Doc link format', new Error('INVALID_REQUEST'), {
      googleDocLink: input.googleDocLink,
    });
    throw buildValidationError(
      'googleDocLink',
      sourceDiagnostics,
      'O link original do modelo está inválido. Corrija esse campo antes de gerar.'
    );
  }

  if (sourceDiagnostics.projectDocLink.status === 'invalid_format') {
    sourceDiagnostics.projectDocLink.message =
      'O link customizado do projeto está inválido e não pode ser usado como fallback.';
    debugLog(requestId, 'resolveTemplateSource', 'Project doc link has invalid format, will not be used as fallback');
  }

  const attemptOrder = getSourceAttemptOrder(sourceDiagnostics, options.preferredSource);
  debugLog(requestId, 'resolveTemplateSource', 'Source attempt order', { attemptOrder });

  const warnings: string[] = [];
  let primaryFailure: TemplateActionError | null = null;
  const preferredProjectFallback =
    options.preferredSource === 'projectDocLink' &&
    sourceDiagnostics.googleDocLink.status === 'available';

  for (const field of attemptOrder) {
    const source = sourceDiagnostics[field];
    const isOriginal = field === 'googleDocLink';

    if (source.status === 'missing') {
      debugLog(requestId, 'resolveTemplateSource', `Source ${field} is missing`, { isOriginal });
      if (isOriginal) {
        continue;
      }
      break;
    }

    if (source.status !== 'available') {
      debugLog(requestId, 'resolveTemplateSource', `Source ${field} is unavailable`, { status: source.status, message: source.message });
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
      const metadata = await validateTemplateSource(client, userId, field, sourceDiagnostics, requestId);
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

      debugLog(requestId, 'resolveTemplateSource', 'Source resolved successfully', {
        field,
        resolvedSource: field,
        fallbackUsed,
        documentId: metadata.id,
        documentName: metadata.name,
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

      debugError(requestId, 'resolveTemplateSource', `Source ${field} validation failed`, error, {
        errorType: getErrorType(typedError),
        googleDocId: sourceDiagnostics.googleDocLink.fileId,
        projectDocId: sourceDiagnostics.projectDocLink.fileId,
      });

      if (field === 'googleDocLink' && isFallbackEligibleErrorType(getErrorType(typedError))) {
        debugLog(requestId, 'resolveTemplateSource', 'Original source failed but fallback eligible, continuing', {
          errorType: getErrorType(typedError),
        });
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
    debugError(requestId, 'resolveTemplateSource', 'Both sources failed - primary failed and custom is missing', primaryFailure, {
      googleDocStatus: sourceDiagnostics.googleDocLink.status,
      projectDocStatus: sourceDiagnostics.projectDocLink.status,
    });
    throw createTemplateActionError(
      getErrorType(primaryFailure),
      primaryFailure.technicalDetails || primaryFailure.message,
      {
        failedSource: 'googleDocLink',
        sourceDiagnostics,
      }
    );
  }

  debugError(requestId, 'resolveTemplateSource', 'No usable template source found', new Error('INVALID_REQUEST'), {
    googleDocStatus: sourceDiagnostics.googleDocLink.status,
    projectDocStatus: sourceDiagnostics.projectDocLink.status,
  });

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
  placeholderMatches: Record<string, string[]>,
  requestId?: string
): Promise<DeterministicGenerationResult> {
  const reqId = requestId || generateRequestId();
  const requests = buildReplacementRequests(placeholderValues, placeholderMatches);

  debugLog(reqId, 'generateContractInDocsWithComposio', 'Building batch update requests', {
    documentId,
    requestCount: requests.length,
    placeholderCount: placeholderValues.length,
  });

  if (requests.length > 0) {
    await client.batchUpdateDocument(documentId, requests);
  }

  debugLog(reqId, 'generateContractInDocsWithComposio', 'Batch update complete', {
    documentId,
    replacementsApplied: requests.length,
  });

  return {
    documentLink: `https://docs.google.com/document/d/${documentId}/edit`,
    replacementsApplied: requests.length,
  };
}

export async function inspectTemplateForGeneration(
  userId: string,
  input: TemplateSourceInput
) {
  const requestId = generateRequestId();
  debugLog(requestId, 'inspectTemplateForGeneration', 'Starting inspection', {
    userId,
    templateId: input.templateId,
    templateName: input.templateName,
    googleDocLink: input.googleDocLink ? extractGoogleDocId(input.googleDocLink) : null,
    projectDocLink: input.projectDocLink ? extractGoogleDocId(input.projectDocLink) : null,
    hasFallbackMarkdown: !!input.fallbackMarkdownContent,
  });

  try {
    const resolved = await resolveTemplateSource(userId, input);
    const client = await createComposioClient(userId);

    // Wrap placeholder extraction with auth retry to handle 401/403 from Google Workspace
    const googleDocPlaceholders = await executeWithRetryAndAuthRefresh(
      () => client.getDocumentPlaceholders(resolved.fileId),
      `getDocumentPlaceholders(${resolved.fileId})`,
      userId,
      requestId
    );

    const placeholders = mergePlaceholderDefinitions(
      googleDocPlaceholders,
      input.fallbackMarkdownContent
    );

    debugLog(requestId, 'inspectTemplateForGeneration', 'Inspection successful', {
      fileId: resolved.fileId,
      resolvedSource: resolved.resolvedSource,
      placeholderCount: placeholders.length,
      warningCount: resolved.warnings.length,
    });

    return {
      success: true,
      fileId: resolved.fileId,
      templateName: resolved.templateName,
      placeholders,
      resolvedSource: resolved.resolvedSource,
      fallbackUsed: resolved.fallbackUsed,
      sourceDiagnostics: resolved.sourceDiagnostics,
      warnings: resolved.warnings,
      requestId,
    };
  } catch (error) {
    debugError(requestId, 'inspectTemplateForGeneration', 'Inspection failed', error, {
      userId,
      templateId: input.templateId,
    });
    return {
      success: false,
      ...buildUserFriendlyError(error),
      requestId,
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
  const requestId = generateRequestId();
  debugLog(requestId, 'generateContractDoc', 'Starting document generation', {
    userId,
    templateId: input.templateId,
    templateName: input.templateName,
    preferredSource: input.preferredSource,
    placeholderCount: Object.keys(input.confirmedPlaceholders).length,
    enrichWithAI: input.enrichWithAI,
  });

  try {
    const resolved = await executeWithRetryAndAuthRefresh(
      () => resolveTemplateSource(userId, input, {
        preferredSource: input.preferredSource,
      }),
      `resolveTemplateSource(${input.templateId})`,
      userId,
      requestId
    );

    debugLog(requestId, 'generateContractDoc', 'Source resolved', {
      resolvedSource: resolved.resolvedSource,
      fallbackUsed: resolved.fallbackUsed,
      googleDocId: resolved.sourceDiagnostics.googleDocLink.fileId,
      projectDocId: resolved.sourceDiagnostics.projectDocLink.fileId,
    });

    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const newFileName = `Contrato - ${input.templateName || resolved.templateName} - ${input.clientName} - ${dateStr}`;

    // Use Composio copyFile (via composio-client adapter)
    const client = await createComposioClient(userId);
    const newFileId = await client.copyFile(resolved.fileId, newFileName);

    debugLog(requestId, 'generateContractDoc', 'File copied successfully', {
      originalFileId: resolved.fileId,
      newFileId,
      newFileName,
    });

    let aiEnriched = false;
    let result: { documentLink: string; replacementsApplied: number };

    // AI ENRICHMENT PATH: use Gemini to infer placeholder values from entity data
    if (input.enrichWithAI && input.entityData) {
      debugLog(requestId, 'generateContractDoc', 'AI enrichment enabled, calling aiEnrichContract', {
        placeholders: Object.keys(input.placeholderMatches),
        entityKeyCount: Object.keys(input.entityData).length,
      });

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
        debugLog(requestId, 'generateContractDoc', 'AI enrichment succeeded', {
          substitutionsApplied: enrichmentResult.substitutions.length,
          unfilled: enrichmentResult.unfilled,
          substitutions: enrichmentResult.substitutions,
        });
      } else {
        console.warn(`[TemplateGeneration] AI enrichment failed (req:${requestId}), falling back to deterministic`, {
          error: enrichmentResult.error,
        });
        debugError(requestId, 'generateContractDoc', 'AI enrichment failed, falling back', new Error(enrichmentResult.error || 'Unknown error'), {
          error: enrichmentResult.error,
        });

        result = await generateContractInDocsWithComposio(
          client,
          newFileId,
          input.confirmedPlaceholders,
          input.placeholderMatches,
          requestId
        );
      }
    } else {
      result = await generateContractInDocsWithComposio(
        client,
        newFileId,
        input.confirmedPlaceholders,
        input.placeholderMatches,
        requestId
      );
    }

    debugLog(requestId, 'generateContractDoc', 'Placeholder replacement completed', {
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
      requestId,
    };
  } catch (error) {
    debugError(requestId, 'generateContractDoc', 'Unhandled generation error', error, {
      userId,
      templateId: input.templateId,
    });
    return {
      success: false,
      ...buildUserFriendlyError(error),
      requestId,
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
 * Does NOT auto-apply — returns suggestions only.
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
  requestId: string;
}> {
  const requestId = generateRequestId();
  debugLog(requestId, 'reviewContractWithAI', 'Starting AI review', {
    userId,
    documentId: input.documentId,
    documentName: input.documentName,
    reviewFocus: input.reviewFocus,
    contractType: input.contractType,
  });

  try {
    await requireComposioConnection(userId, requestId);

    const result = await aiReviewContract({
      userId,
      documentId: input.documentId,
      documentName: input.documentName,
      context: input.context,
      reviewFocus: input.reviewFocus || 'all',
      contractType: input.contractType,
    });

    debugLog(requestId, 'reviewContractWithAI', 'AI review completed', {
      success: result.success,
      suggestionCount: result.suggestions?.length,
      overallQuality: result.overallQuality,
      error: result.error,
    });

    return {
      ...result,
      requestId,
    };
  } catch (error) {
    debugError(requestId, 'reviewContractWithAI', 'Unhandled review error', error, {
      userId,
      documentId: input.documentId,
    });
    return {
      success: false,
      documentId: input.documentId,
      summary: '',
      overallQuality: 'requires_revision',
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      requestId,
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
): Promise<{ success: boolean; editsApplied: number; documentLink: string; error?: string; requestId: string }> {
  const requestId = generateRequestId();
  debugLog(requestId, 'applyReviewEdits', 'Starting edit application', {
    userId,
    documentId: input.documentId,
    contractId: input.contractId,
    editCount: input.edits.length,
  });

  try {
    await requireComposioConnection(userId, requestId);

    if (!input.edits || input.edits.length === 0) {
      debugLog(requestId, 'applyReviewEdits', 'No edits to apply', { documentId: input.documentId });
      return {
        success: true,
        editsApplied: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
        requestId,
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
      debugLog(requestId, 'applyReviewEdits', 'No valid requests after filtering', { documentId: input.documentId });
      return {
        success: true,
        editsApplied: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
        requestId,
      };
    }

    const client = await createComposioClient(userId);
    await client.batchUpdateDocument(input.documentId, requests);

    debugLog(requestId, 'applyReviewEdits', 'Edits applied via Composio', {
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
        debugLog(requestId, 'applyReviewEdits', 'Edits stored in Firestore for undo', { contractId: input.contractId });
      } catch (firestoreError) {
        // Non-fatal: log but don't fail the operation
        console.warn('[applyReviewEdits] Failed to store edits in Firestore:', firestoreError);
        debugError(requestId, 'applyReviewEdits', 'Failed to store edits in Firestore (non-fatal)', firestoreError, {
          contractId: input.contractId,
        });
      }
    }

    return {
      success: true,
      editsApplied: requests.length,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      requestId,
    };
  } catch (error) {
    debugError(requestId, 'applyReviewEdits', 'Failed to apply edits', error, {
      userId,
      documentId: input.documentId,
      editCount: input.edits.length,
    });
    return {
      success: false,
      editsApplied: 0,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      error: error instanceof Error ? error.message : String(error),
      requestId,
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
): Promise<{ success: boolean; editsReverted: number; documentLink: string; error?: string; requestId: string }> {
  const requestId = generateRequestId();
  debugLog(requestId, 'revertReviewEdits', 'Starting edit revert', {
    userId,
    documentId: input.documentId,
    contractId: input.contractId,
    editCount: input.edits.length,
  });

  try {
    await requireComposioConnection(userId, requestId);

    if (!input.edits || input.edits.length === 0) {
      debugLog(requestId, 'revertReviewEdits', 'No edits to revert', { documentId: input.documentId });
      return {
        success: true,
        editsReverted: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
        requestId,
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
      debugLog(requestId, 'revertReviewEdits', 'No valid requests after filtering', { documentId: input.documentId });
      return {
        success: true,
        editsReverted: 0,
        documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
        requestId,
      };
    }

    const client = await createComposioClient(userId);
    await client.batchUpdateDocument(input.documentId, requests);

    debugLog(requestId, 'revertReviewEdits', 'Edits reverted via Composio', {
      documentId: input.documentId,
      editsReverted: requests.length,
    });

    // Clear stored edits from Firestore after successful revert
    if (input.contractId) {
      try {
        await db.collection('projectContracts').doc(input.contractId).update({
          lastReviewEdits: null,
        });
        debugLog(requestId, 'revertReviewEdits', 'Cleared edits from Firestore', { contractId: input.contractId });
      } catch (firestoreError) {
        // Non-fatal: log but don't fail the operation
        console.warn('[revertReviewEdits] Failed to clear edits from Firestore:', firestoreError);
        debugError(requestId, 'revertReviewEdits', 'Failed to clear edits from Firestore (non-fatal)', firestoreError, {
          contractId: input.contractId,
        });
      }
    }

    return {
      success: true,
      editsReverted: requests.length,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      requestId,
    };
  } catch (error) {
    debugError(requestId, 'revertReviewEdits', 'Failed to revert edits', error, {
      userId,
      documentId: input.documentId,
      editCount: input.edits.length,
    });
    return {
      success: false,
      editsReverted: 0,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      error: error instanceof Error ? error.message : String(error),
      requestId,
    };
  }
}
