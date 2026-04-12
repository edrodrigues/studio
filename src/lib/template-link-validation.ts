import { type Template, type TemplateLinkValidationEntry } from "./types";
import { auditTemplateLinks, type TemplateSourceField } from "./template-source";

export const GOOGLE_DOCS_MIME_TYPE = "application/vnd.google-apps.document";

export type TemplateValidationHealth =
  | "ready_with_fallback"
  | "ready_original"
  | "ready_custom"
  | "ready_fallback_only"
  | "pending_validation"
  | "needs_attention";

export interface TemplateValidationSummary {
  health: TemplateValidationHealth;
  label: string;
  description: string;
  isSelectable: boolean;
  original: TemplateLinkValidationEntry;
  custom: TemplateLinkValidationEntry;
}

function getCurrentLink(template: Template, field: TemplateSourceField) {
  return (field === "googleDocLink" ? template.googleDocLink : template.projectDocLink)?.trim() || "";
}

function getStoredValidation(template: Template, field: TemplateSourceField) {
  const currentLink = getCurrentLink(template, field);
  const stored =
    field === "googleDocLink"
      ? template.linkValidation?.googleDocLink
      : template.linkValidation?.projectDocLink;

  if (!stored) {
    return null;
  }

  return stored.link.trim() === currentLink ? stored : null;
}

function synthesizeValidation(template: Template, field: TemplateSourceField): TemplateLinkValidationEntry {
  const currentLink = getCurrentLink(template, field);
  const audit = auditTemplateLinks(template.googleDocLink, template.projectDocLink)[field];

  if (audit.status === "missing") {
    return {
      status: "missing",
      link: currentLink,
      error: null,
    };
  }

  if (audit.status === "invalid_format") {
    return {
      status: "invalid_format",
      link: currentLink,
      fileId: audit.fileId,
      error: audit.message || `O ${audit.label} não contém um Google Docs válido.`,
    };
  }

  return {
    status: "pending",
    link: currentLink,
    fileId: audit.fileId,
    error: "O link ainda não foi validado remotamente.",
  };
}

export function getTemplateLinkValidationState(
  template: Template,
  field: TemplateSourceField
): TemplateLinkValidationEntry {
  return getStoredValidation(template, field) || synthesizeValidation(template, field);
}

export function isValidatedGoogleDoc(validation: TemplateLinkValidationEntry | null | undefined) {
  return validation?.status === "valid_google_doc";
}

function getAttentionDescription(validation: TemplateLinkValidationEntry, fallbackAvailable: boolean) {
  switch (validation.status) {
    case "pending":
      return "O link foi preenchido, mas ainda não passou pela validação remota.";
    case "invalid_file_type":
      return validation.error || "O arquivo precisa ser um Google Docs nativo.";
    case "inaccessible":
      return validation.error || "O arquivo não está acessível com a conta validada por último.";
    case "invalid_format":
      return validation.error || "O link salvo não tem formato válido de Google Docs.";
    case "missing":
      return fallbackAvailable
        ? "A geração depende apenas do fallback customizado do projeto."
        : "Cadastre pelo menos um Google Docs válido para liberar a geração.";
    default:
      return validation.error || "Revise os links do template antes de gerar.";
  }
}

export function summarizeTemplateValidation(template: Template): TemplateValidationSummary {
  const original = getTemplateLinkValidationState(template, "googleDocLink");
  const custom = getTemplateLinkValidationState(template, "projectDocLink");
  const originalReady = isValidatedGoogleDoc(original);
  const customReady = isValidatedGoogleDoc(custom);

  if (originalReady && customReady) {
    return {
      health: "ready_with_fallback",
      label: "Original + fallback validados",
      description:
        "O modelo tem um Google Docs original validado e uma versão customizada pronta para fallback.",
      isSelectable: true,
      original,
      custom,
    };
  }

  if (originalReady) {
    return {
      health: "ready_original",
      label: "Original validado",
      description: custom.status === "missing"
        ? "A geração pode usar o link original, mas ainda não há fallback customizado."
        : "A geração pode usar o link original validado.",
      isSelectable: true,
      original,
      custom,
    };
  }

  if (customReady && original.status === "missing") {
    return {
      health: "ready_custom",
      label: "Fallback validado",
      description:
        "A geração usará a versão customizada do projeto porque o link original está vazio.",
      isSelectable: true,
      original,
      custom,
    };
  }

  if (customReady) {
    return {
      health: "ready_fallback_only",
      label: "Fallback pronto",
      description: getAttentionDescription(original, true),
      isSelectable: true,
      original,
      custom,
    };
  }

  if (original.status === "pending" || custom.status === "pending") {
    return {
      health: "pending_validation",
      label: "Validação pendente",
      description:
        "O template tem links preenchidos, mas ainda não existe uma validação remota confiável para liberar a geração.",
      isSelectable: false,
      original,
      custom,
    };
  }

  return {
    health: "needs_attention",
    label: "Requer correção",
    description: getAttentionDescription(original.status !== "missing" ? original : custom, false),
    isSelectable: false,
    original,
    custom,
  };
}
