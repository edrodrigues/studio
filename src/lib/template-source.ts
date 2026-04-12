import { extractGoogleDocId } from './utils';

export type TemplateSourceField = 'googleDocLink' | 'projectDocLink';

export type TemplateHealthState =
  | 'ready_original'
  | 'ready_custom'
  | 'ready_with_fallback'
  | 'misconfigured';

export type TemplateSourceStatus =
  | 'missing'
  | 'invalid_format'
  | 'available'
  | 'unavailable';

export interface TemplateSourceDiagnostic {
  field: TemplateSourceField;
  label: string;
  link: string;
  fileId: string | null;
  fileName?: string;
  mimeType?: string;
  status: TemplateSourceStatus;
  errorType?: string;
  message?: string;
}

export interface TemplateSourceAudit {
  googleDocLink: TemplateSourceDiagnostic;
  projectDocLink: TemplateSourceDiagnostic;
  health: TemplateHealthState;
}

const SOURCE_LABELS: Record<TemplateSourceField, string> = {
  googleDocLink: 'link original',
  projectDocLink: 'link customizado',
};

function buildSourceDiagnostic(
  field: TemplateSourceField,
  rawLink?: string
): TemplateSourceDiagnostic {
  const link = rawLink?.trim() || '';
  const fileId = extractGoogleDocId(link);

  if (!link) {
    return {
      field,
      label: SOURCE_LABELS[field],
      link,
      fileId: null,
      status: 'missing',
    };
  }

  if (!fileId) {
    return {
      field,
      label: SOURCE_LABELS[field],
      link,
      fileId: null,
      status: 'invalid_format',
      errorType: 'INVALID_REQUEST',
      message: `O ${SOURCE_LABELS[field]} não contém um Google Docs válido.`,
    };
  }

  return {
    field,
    label: SOURCE_LABELS[field],
    link,
    fileId,
    status: 'available',
  };
}

export function getTemplateSourceFieldLabel(field: TemplateSourceField) {
  return SOURCE_LABELS[field];
}

export function auditTemplateLinks(
  googleDocLink?: string,
  projectDocLink?: string
): TemplateSourceAudit {
  const original = buildSourceDiagnostic('googleDocLink', googleDocLink);
  const custom = buildSourceDiagnostic('projectDocLink', projectDocLink);

  let health: TemplateHealthState = 'misconfigured';

  if (original.status === 'available' && custom.status === 'available') {
    health = 'ready_with_fallback';
  } else if (original.status === 'available') {
    health = 'ready_original';
  } else if (original.status === 'missing' && custom.status === 'available') {
    health = 'ready_custom';
  }

  return {
    googleDocLink: original,
    projectDocLink: custom,
    health,
  };
}

export function isFallbackEligibleErrorType(errorType?: string | null) {
  return errorType === 'TEMPLATE_NOT_FOUND' || errorType === 'PERMISSION_DENIED' || errorType === 'INVALID_TEMPLATE_TYPE';
}
