'use server';

/**
 * Legacy Google OAuth implementation.
 *
 * The Gerar e Exportar page uses composio-actions.ts for Docs/Drive generation.
 * Keep this file only for older direct-access-token callers and parity with
 * tests that still exercise the legacy path.
 */

import { generateContractInDocs } from '@/ai/flows/generate-contract-in-docs';
import {
  getDocumentPlaceholders,
} from '@/lib/google-docs';
import { copyFile, getFileMetadata } from '@/lib/google-drive';
import {
  auditTemplateLinks,
  isFallbackEligibleErrorType,
  type TemplateSourceAudit,
  type TemplateSourceDiagnostic,
  type TemplateSourceField,
} from '@/lib/template-source';
import {
  getErrorType,
  cloneSourceDiagnostics,
  createTemplateActionError,
  buildValidationError,
  updateSourceFailure,
  getSourceAttemptOrder,
  buildUserFriendlyError,
  mergePlaceholderDefinitions,
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

// Helper functions are imported from shared-docs-actions.ts

async function validateTemplateSource(
  accessToken: string,
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

  const metadata = await getFileMetadata(accessToken, source.fileId);
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
  accessToken: string,
  input: TemplateSourceInput,
  options: ResolveTemplateSourceOptions = {}
): Promise<ResolvedTemplateSource> {
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
      const metadata = await validateTemplateSource(accessToken, field, sourceDiagnostics);
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

// buildUserFriendlyError and mergePlaceholderDefinitions are imported from shared-docs-actions.ts

export async function inspectTemplateForGeneration(
  accessToken: string,
  input: TemplateSourceInput
) {
  try {
    const resolved = await resolveTemplateSource(accessToken, input);
    const googleDocPlaceholders = await getDocumentPlaceholders(accessToken, resolved.fileId);
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
  accessToken: string,
  input: TemplateSourceInput & {
    preferredSource?: TemplateSourceField;
    clientName: string;
    confirmedPlaceholders: Record<string, string>;
    placeholderMatches: Record<string, string[]>;
    projectId?: string;
  }
) {
  try {
    const resolved = await resolveTemplateSource(accessToken, input, {
      preferredSource: input.preferredSource,
    });

    console.log('[TemplateGeneration] Starting Google Doc generation', {
      templateId: input.templateId,
      templateName: input.templateName,
      resolvedSource: resolved.resolvedSource,
      fallbackUsed: resolved.fallbackUsed,
      googleDocId: resolved.sourceDiagnostics.googleDocLink.fileId,
      projectDocId: resolved.sourceDiagnostics.projectDocLink.fileId,
    });

    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const newFileName = `Contrato - ${input.templateName || resolved.templateName} - ${input.clientName} - ${dateStr}`;

    const newFileId = await copyFile(accessToken, resolved.fileId, newFileName);
    console.log('[TemplateGeneration] Successfully copied template', {
      templateId: input.templateId,
      templateName: input.templateName,
      resolvedSource: resolved.resolvedSource,
      newFileId,
    });

    const result = await generateContractInDocs({
      accessToken,
      documentId: newFileId,
      placeholderValues: input.confirmedPlaceholders,
      placeholderMatches: input.placeholderMatches,
      projectId: input.projectId,
    });

    console.log('[TemplateGeneration] Placeholder replacement completed', {
      templateId: input.templateId,
      templateName: input.templateName,
      resolvedSource: resolved.resolvedSource,
      replacementsApplied: result.replacementsApplied,
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
    };
  } catch (error) {
    console.error('Error in generateContractDoc Server Action:', error);
    return {
      success: false,
      ...buildUserFriendlyError(error),
    };
  }
}
