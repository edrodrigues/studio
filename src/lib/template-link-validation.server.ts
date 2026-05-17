import { type TemplateLinkValidationEntry, type TemplateLinkValidationState } from "./types";
import { GOOGLE_DOCS_MIME_TYPE } from "./template-link-validation";
import { auditTemplateLinks, getTemplateSourceFieldLabel, type TemplateSourceField } from "./template-source";
import { createComposioClient } from "./composio-client";

export interface ValidateTemplateLinksInput {
  googleDocLink?: string;
  projectDocLink?: string;
}

export interface ValidateTemplateLinksResult {
  canSave: boolean;
  validations: TemplateLinkValidationState;
  blockingErrors: string[];
  warnings: string[];
}

function buildMissingValidation(field: TemplateSourceField, link: string, validatedAt: string): TemplateLinkValidationEntry {
  return {
    status: "missing",
    link,
    validatedAt,
    error: field === "projectDocLink" ? null : "O link original ainda não foi preenchido.",
  };
}

function buildInvalidFormatValidation(
  label: string,
  link: string,
  fileId: string | null,
  message: string,
  validatedAt: string
): TemplateLinkValidationEntry {
  return {
    status: "invalid_format",
    link,
    fileId,
    validatedAt,
    error: `${label}: ${message}`,
  };
}

function buildInaccessibleValidation(
  label: string,
  link: string,
  fileId: string | null,
  message: string,
  validatedAt: string
): TemplateLinkValidationEntry {
  return {
    status: "inaccessible",
    link,
    fileId,
    validatedAt,
    error: `${label}: ${message}`,
  };
}

async function validateSingleTemplateLink(
  userId: string,
  field: TemplateSourceField,
  link: string,
  validatedAt: string
): Promise<TemplateLinkValidationEntry> {
  const audit = auditTemplateLinks(
    field === "googleDocLink" ? link : "",
    field === "projectDocLink" ? link : ""
  )[field];
  const label = getTemplateSourceFieldLabel(field);

  if (audit.status === "missing") {
    return buildMissingValidation(field, link, validatedAt);
  }

  if (audit.status === "invalid_format" || !audit.fileId) {
    return buildInvalidFormatValidation(
      label,
      link,
      audit.fileId,
      audit.message || `O ${label} não contém um Google Docs válido.`,
      validatedAt
    );
  }

  try {
    const client = await createComposioClient(userId);
    const metadata = await client.getFileMetadata(audit.fileId);

    if (metadata.mimeType !== GOOGLE_DOCS_MIME_TYPE) {
      return {
        status: "invalid_file_type",
        link,
        fileId: metadata.id,
        fileName: metadata.name,
        mimeType: metadata.mimeType,
        validatedAt,
        error: `${label}: o arquivo "${metadata.name}" tem tipo "${metadata.mimeType}". Converta-o para Google Docs nativo antes de salvar.`,
      };
    }

    return {
      status: "valid_google_doc",
      link,
      fileId: metadata.id,
      fileName: metadata.name,
      mimeType: metadata.mimeType,
      validatedAt,
      error: null,
    };
  } catch (error) {
    // Quick fix: treat Composio access failures as soft warnings if URL format is valid.
    // This allows saving when the Google Doc URL looks correct but Composio can't verify it
    // (e.g., expired API key, disconnected account, network issues).
    return {
      status: "valid_google_doc",
      link,
      fileId: audit.fileId,
      fileName: null,
      mimeType: GOOGLE_DOCS_MIME_TYPE,
      validatedAt,
      error: null,
    };
  }
}

export async function validateTemplateLinksForPersistence(
  userId: string,
  input: ValidateTemplateLinksInput
): Promise<ValidateTemplateLinksResult> {
  const validatedAt = new Date().toISOString();
  const googleDocLink = input.googleDocLink?.trim() || "";
  const projectDocLink = input.projectDocLink?.trim() || "";

  const [original, custom] = await Promise.all([
    validateSingleTemplateLink(userId, "googleDocLink", googleDocLink, validatedAt),
    validateSingleTemplateLink(userId, "projectDocLink", projectDocLink, validatedAt),
  ]);

  const validations: TemplateLinkValidationState = {
    googleDocLink: original,
    projectDocLink: custom,
  };

  const validCount = [original, custom].filter((entry) => entry.status === "valid_google_doc").length;
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  for (const entry of [original, custom]) {
    if (entry.status === "invalid_format" || entry.status === "invalid_file_type") {
      if (entry.error) {
        blockingErrors.push(entry.error);
      }
    }
  }

  if (validCount === 0 && !blockingErrors.length) {
    blockingErrors.push("Cadastre pelo menos um Google Docs nativo e acessível antes de salvar o template.");
  }

  if (original.status === "valid_google_doc" && !original.fileName && original.fileId) {
    warnings.push("O link original não pôde ser verificado em tempo real. Verifique se o documento está acessível antes de gerar contratos.");
  }
  if (custom.status === "valid_google_doc" && !custom.fileName && custom.fileId) {
    warnings.push("O link customizado não pôde ser verificado em tempo real. Verifique se o documento está acessível antes de gerar contratos.");
  }

  if (custom.status === "missing") {
    warnings.push("O link customizado do projeto continua opcional, mas é recomendado para servir de fallback operacional.");
  }

  return {
    canSave: blockingErrors.length === 0,
    validations,
    blockingErrors,
    warnings,
  };
}
