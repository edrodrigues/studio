'use server';

import { generateContractInDocs } from '@/ai/flows/generate-contract-in-docs';
import {
  extractPlaceholderDefinitionsFromText,
  getDocumentPlaceholders,
} from '@/lib/google-docs';
import { copyFile, getFileMetadata } from '@/lib/google-drive';
import {
  auditTemplateLinks,
  getTemplateSourceFieldLabel,
  isFallbackEligibleErrorType,
  type TemplateSourceAudit,
  type TemplateSourceDiagnostic,
  type TemplateSourceField,
} from '@/lib/template-source';

type PlaceholderDefinition = {
  key: string;
  matches: string[];
};

type TemplateErrorType =
  | 'TEMPLATE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_REQUEST'
  | 'INVALID_TEMPLATE_TYPE'
  | 'AUTH_EXPIRED'
  | 'GOOGLE_DRIVE_ERROR'
  | 'UNKNOWN_ERROR';

type TemplateSourceDiagnostics = Record<TemplateSourceField, TemplateSourceDiagnostic>;

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

type TemplateActionError = Error & {
  errorType?: TemplateErrorType;
  failedSource?: TemplateSourceField;
  sourceDiagnostics?: TemplateSourceDiagnostics;
  technicalDetails?: string;
};

type ResolvedTemplateSource = {
  fileId: string;
  templateName: string;
  resolvedSource: TemplateSourceField;
  fallbackUsed: boolean;
  sourceDiagnostics: TemplateSourceDiagnostics;
  warnings: string[];
};

function getErrorType(error: unknown): TemplateErrorType {
  if (error && typeof error === 'object' && 'errorType' in error && typeof error.errorType === 'string') {
    return error.errorType as TemplateErrorType;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  const matchedType = [
    'TEMPLATE_NOT_FOUND',
    'PERMISSION_DENIED',
    'INVALID_REQUEST',
    'INVALID_TEMPLATE_TYPE',
    'AUTH_EXPIRED',
    'GOOGLE_DRIVE_ERROR',
  ].find((candidate) => message.includes(candidate));

  return (matchedType as TemplateErrorType | undefined) || 'UNKNOWN_ERROR';
}

function cloneSourceDiagnostics(audit: TemplateSourceAudit): TemplateSourceDiagnostics {
  return {
    googleDocLink: { ...audit.googleDocLink },
    projectDocLink: { ...audit.projectDocLink },
  };
}

function createTemplateActionError(
  errorType: TemplateErrorType,
  technicalDetails: string,
  extras: Omit<Partial<TemplateActionError>, 'message'> = {}
): TemplateActionError {
  const error = new Error(technicalDetails) as TemplateActionError;
  error.errorType = errorType;
  error.technicalDetails = technicalDetails;
  Object.assign(error, extras);
  return error;
}

function buildValidationError(
  field: TemplateSourceField,
  diagnostics: TemplateSourceDiagnostics,
  technicalDetails: string
) {
  return createTemplateActionError('INVALID_REQUEST', technicalDetails, {
    failedSource: field,
    sourceDiagnostics: diagnostics,
  });
}

function updateSourceFailure(
  sourceDiagnostics: TemplateSourceDiagnostics,
  field: TemplateSourceField,
  error: unknown
) {
  const errorType = getErrorType(error);
  sourceDiagnostics[field] = {
    ...sourceDiagnostics[field],
    status: 'unavailable',
    errorType,
    message: error instanceof Error ? error.message : String(error ?? ''),
  };
}

function getSourceAttemptOrder(
  sourceDiagnostics: TemplateSourceDiagnostics,
  preferredSource?: TemplateSourceField
): TemplateSourceField[] {
  const defaultOrder: TemplateSourceField[] = ['googleDocLink', 'projectDocLink'];

  if (!preferredSource || sourceDiagnostics[preferredSource].status !== 'available') {
    return defaultOrder;
  }

  const alternateSource = preferredSource === 'googleDocLink' ? 'projectDocLink' : 'googleDocLink';
  return [preferredSource, alternateSource];
}

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

  if (metadata.mimeType !== 'application/vnd.google-apps.document') {
    throw createTemplateActionError(
      'INVALID_TEMPLATE_TYPE',
      `O ${source.label} precisa apontar para um Google Docs editável.`,
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
      const fallbackUsed = field === 'projectDocLink' && Boolean(primaryFailure);

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

function buildUserFriendlyError(error: unknown) {
  const typedError =
    error instanceof Error
      ? (error as TemplateActionError)
      : createTemplateActionError('UNKNOWN_ERROR', String(error ?? 'Unknown error'));

  const errorType = getErrorType(typedError);
  const sourceDiagnostics = typedError.sourceDiagnostics;
  const failedSource = typedError.failedSource;
  const failedLabel = failedSource ? getTemplateSourceFieldLabel(failedSource) : 'template';

  let errorMessage = 'Não foi possível usar o template informado.';
  let userInstructions: string[] = [];

  const bothUnavailable =
    sourceDiagnostics &&
    sourceDiagnostics.googleDocLink.status === 'unavailable' &&
    sourceDiagnostics.projectDocLink.status === 'unavailable';

  switch (errorType) {
    case 'TEMPLATE_NOT_FOUND':
      errorMessage = bothUnavailable
        ? 'Nenhuma fonte de template acessível foi encontrada no Google Drive.'
        : `O ${failedLabel} não foi encontrado no Google Drive.`;
      userInstructions = [
        'Verifique se o documento ainda existe e não foi deletado.',
        'Confirme se o link salvo no modelo aponta para o documento correto.',
        'Se o link original falhou, preencha ou revise a versão customizada do projeto.',
      ];
      break;
    case 'PERMISSION_DENIED':
      errorMessage = bothUnavailable
        ? 'Nenhuma fonte de template está compartilhada com a conta Google conectada.'
        : `A conta conectada não tem permissão para acessar o ${failedLabel}.`;
      userInstructions = [
        'Compartilhe o documento com a conta Google usada no app.',
        'Confirme se você está autenticado com a conta correta.',
        'Se existir uma versão customizada do projeto, confirme se ela também está acessível.',
      ];
      break;
    case 'AUTH_EXPIRED':
      errorMessage = 'Sua sessão com o Google expirou.';
      userInstructions = [
        'Faça login novamente com sua conta Google.',
        'Depois refaça a validação do template.',
      ];
      break;
    case 'INVALID_TEMPLATE_TYPE':
      errorMessage = `O ${failedLabel} não aponta para um Google Docs editável.`;
      userInstructions = [
        'Use um documento do Google Docs, não PDF ou outro tipo de arquivo.',
        'Abra o documento no navegador e copie o link em docs.google.com/document/...',
      ];
      break;
    case 'INVALID_REQUEST':
      errorMessage = sourceDiagnostics
        ? 'Nenhum link de template utilizável está configurado.'
        : 'O link do template está inválido.';
      userInstructions = [
        'Revise o link original do modelo e a versão customizada do projeto.',
        'Use URLs completas de Google Docs ou IDs válidos do documento.',
        'Corrija primeiro links inválidos; o fallback só é usado quando o original existe mas está inacessível.',
      ];
      break;
    default:
      errorMessage = 'O Google Drive retornou um erro inesperado ao preparar o template.';
      userInstructions = [
        'Tente novamente em alguns instantes.',
        'Se o erro persistir, revise os links do template e a conta Google conectada.',
      ];
      break;
  }

  return {
    error: errorMessage,
    errorType,
    failedSource,
    userInstructions,
    sourceDiagnostics,
    technicalDetails: typedError.technicalDetails || typedError.message,
  };
}

function mergePlaceholderDefinitions(
  googleDocPlaceholders: PlaceholderDefinition[],
  fallbackMarkdownContent?: string
) {
  const fallbackPlaceholders = fallbackMarkdownContent
    ? extractPlaceholderDefinitionsFromText(fallbackMarkdownContent)
    : [];

  const placeholderMap = new Map<string, Set<string>>();

  for (const definition of [...googleDocPlaceholders, ...fallbackPlaceholders]) {
    if (!placeholderMap.has(definition.key)) {
      placeholderMap.set(definition.key, new Set<string>());
    }

    for (const match of definition.matches) {
      placeholderMap.get(definition.key)?.add(match);
    }
  }

  return Array.from(placeholderMap.entries())
    .map(([key, matches]) => ({
      key,
      matches: Array.from(matches).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

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
