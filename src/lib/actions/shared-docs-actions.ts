import {
  extractPlaceholderDefinitionsFromText,
} from '@/lib/google-docs';
import {
  getTemplateSourceFieldLabel,
  type TemplateSourceAudit,
  type TemplateSourceDiagnostic,
  type TemplateSourceField,
} from '@/lib/template-source';

// ============================================================
// SHARED TYPE DEFINITIONS
// ============================================================

export type PlaceholderDefinition = {
  key: string;
  matches: string[];
};

export type TemplateErrorType =
  | 'TEMPLATE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_REQUEST'
  | 'INVALID_TEMPLATE_TYPE'
  | 'AUTH_EXPIRED'
  | 'GOOGLE_DRIVE_ERROR'
  | 'GOOGLE_DOCS_ERROR'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

export type TemplateSourceDiagnostics = Record<TemplateSourceField, TemplateSourceDiagnostic>;

export type TemplateActionError = Error & {
  errorType?: TemplateErrorType;
  failedSource?: TemplateSourceField;
  sourceDiagnostics?: TemplateSourceDiagnostics;
  technicalDetails?: string;
};

// ============================================================
// SHARED HELPER FUNCTIONS
// ============================================================

export function getErrorType(error: unknown): TemplateErrorType {
  if (error && typeof error === 'object' && 'errorType' in error && typeof error.errorType === 'string') {
    return error.errorType as TemplateErrorType;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  // Check for Google Workspace domain-level authorization restrictions
  // These return generic 403 messages like "Autorização para atuação de servidores (técnicos e docentes) da UFPE no Projeto"
  // or contain "domain", "organization", "workspace" keywords indicating policy-level blocks
  if (
    message.includes('403') ||
    message.includes('domain') ||
    message.includes('organization') ||
    message.includes('workspace') ||
    message.includes('Autorização') ||
    message.includes('autorização') ||
    message.includes('permitted') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('domain policy') ||
    message.includes('admin')
  ) {
    return 'PERMISSION_DENIED';
  }

  const matchedType = [
    'TEMPLATE_NOT_FOUND',
    'INVALID_REQUEST',
    'INVALID_TEMPLATE_TYPE',
    'AUTH_EXPIRED',
    'GOOGLE_DRIVE_ERROR',
    'GOOGLE_DOCS_ERROR',
    'RATE_LIMITED',
  ].find((candidate) => message.includes(candidate));

  return (matchedType as TemplateErrorType | undefined) || 'UNKNOWN_ERROR';
}

export function cloneSourceDiagnostics(audit: TemplateSourceAudit): TemplateSourceDiagnostics {
  return {
    googleDocLink: { ...audit.googleDocLink },
    projectDocLink: { ...audit.projectDocLink },
  };
}

export function createTemplateActionError(
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

export function buildValidationError(
  field: TemplateSourceField,
  diagnostics: TemplateSourceDiagnostics,
  technicalDetails: string
) {
  return createTemplateActionError('INVALID_REQUEST', technicalDetails, {
    failedSource: field,
    sourceDiagnostics: diagnostics,
  });
}

export function updateSourceFailure(
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

export function getSourceAttemptOrder(
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

export function buildUserFriendlyError(error: unknown) {
  const typedError =
    error instanceof Error
      ? (error as TemplateActionError)
      : createTemplateActionError('UNKNOWN_ERROR', String(error ?? 'Unknown error'));

  const errorType = getErrorType(typedError);
  const sourceDiagnostics = typedError.sourceDiagnostics;
  const failedSource = typedError.failedSource;
  const failedLabel = failedSource ? getTemplateSourceFieldLabel(failedSource) : 'template';
  const failedDiagnostic = failedSource ? sourceDiagnostics?.[failedSource] : undefined;

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
        'Se o erro mencionar "domínio" ou "organização", solicite ao administrador do Google Workspace que libere o acesso ou verifique as políticas de compartilhamento externo.',
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
      errorMessage = bothUnavailable
        ? 'Nenhuma fonte de template é um Google Docs editável.'
        : failedDiagnostic?.fileName && failedDiagnostic?.mimeType
          ? `O ${failedLabel} aponta para "${failedDiagnostic.fileName}", que é "${failedDiagnostic.mimeType}", e não um Google Docs editável.`
          : `O ${failedLabel} não aponta para um Google Docs editável.`;
      userInstructions = [
        'Use um documento do Google Docs, não PDF, Planilha ou outro tipo de arquivo.',
        'Abra o documento no navegador e copie o link em docs.google.com/document/...',
        'Converta o arquivo atual para Google Docs nativo antes de atualizar o link salvo.',
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
    case 'GOOGLE_DOCS_ERROR':
      errorMessage = 'Erro ao ler o conteúdo do documento no Google Docs.';
      userInstructions = [
        'Verifique se o documento está acessível e não está corrompido.',
        'Tente novamente em alguns instantes.',
        'Se o erro persistir, revise os links do template e a conta Google conectada.',
      ];
      break;
    case 'RATE_LIMITED':
      errorMessage = 'Limite de requisições ao Google atingido.';
      userInstructions = [
        'Aguarde alguns segundos e tente novamente.',
        'Se o erro persistir, tente novamente em alguns minutos.',
      ];
      break;
    default:
      const originalMessage = typedError.technicalDetails || typedError.message;
      errorMessage = `O Google Drive/Docs retornou um erro inesperado ao preparar o template. ${originalMessage ? `Detalhes: ${originalMessage}` : ''}`;
      userInstructions = [
        'Tente novamente em alguns instantes.',
        'Se o erro persistir, revise os links do template e a conta Google conectada.',
        'Compartilhe os detalhes do erro com o suporte técnico para investigação.',
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

export function mergePlaceholderDefinitions(
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

export function buildReplacementRequests(
  placeholderValues: Record<string, string>,
  placeholderMatches: Record<string, string[]>
) {
  const requests: Array<{
    replaceAllText: {
      replaceText: string;
      containsText: {
        text: string;
        matchCase: boolean;
      };
    };
  }> = [];

  for (const [placeholderKey, replacement] of Object.entries(placeholderValues)) {
    const trimmedReplacement = replacement.trim();
    if (!trimmedReplacement) {
      continue;
    }

    const exactMatches = placeholderMatches[placeholderKey] || [];
    const generatedMatches = [
      ...exactMatches,
      `<<${placeholderKey}>>`,
      `{{${placeholderKey}}}`,
      `[[${placeholderKey}]]`,
      `<${placeholderKey}>`,
    ];

    const uniqueMatches = Array.from(
      new Set(generatedMatches.map((match) => match.trim()).filter(Boolean))
    );

    for (const match of uniqueMatches) {
      requests.push({
        replaceAllText: {
          replaceText: trimmedReplacement,
          containsText: {
            text: match,
            matchCase: false,
          },
        },
      });
    }
  }

  return requests;
}
