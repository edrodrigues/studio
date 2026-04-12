import { describe, expect, it } from "vitest";

import { summarizeTemplateValidation } from "./template-link-validation";
import type { Template } from "./types";

function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template-1",
    name: "Modelo TED",
    description: "",
    markdownContent: "",
    googleDocLink: "",
    projectDocLink: "",
    contractTypes: ["TED"],
    ...overrides,
  };
}

describe("summarizeTemplateValidation", () => {
  it("marks templates as pending when the URL looks valid but no remote validation was persisted", () => {
    const summary = summarizeTemplateValidation(
      createTemplate({
        googleDocLink: "https://docs.google.com/document/d/1originalTemplateId123456/edit",
      })
    );

    expect(summary.health).toBe("pending_validation");
    expect(summary.isSelectable).toBe(false);
  });

  it("uses persisted validation metadata to allow fallback-only generation", () => {
    const summary = summarizeTemplateValidation(
      createTemplate({
        googleDocLink: "https://docs.google.com/document/d/1wordDocId123456/edit",
        projectDocLink: "https://docs.google.com/document/d/1fallbackId123456/edit",
        linkValidation: {
          googleDocLink: {
            status: "invalid_file_type",
            link: "https://docs.google.com/document/d/1wordDocId123456/edit",
            fileId: "1wordDocId123456",
            fileName: "Declaracao.docx",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            validatedAt: "2026-04-12T00:00:00.000Z",
            error: 'link original: o arquivo "Declaracao.docx" tem tipo "application/vnd.openxmlformats-officedocument.wordprocessingml.document".',
          },
          projectDocLink: {
            status: "valid_google_doc",
            link: "https://docs.google.com/document/d/1fallbackId123456/edit",
            fileId: "1fallbackId123456",
            fileName: "Fallback Projeto",
            mimeType: "application/vnd.google-apps.document",
            validatedAt: "2026-04-12T00:00:00.000Z",
            error: null,
          },
        },
      })
    );

    expect(summary.health).toBe("ready_fallback_only");
    expect(summary.isSelectable).toBe(true);
    expect(summary.description).toContain("Declaracao.docx");
  });

  it("keeps original-only templates selectable after a successful validation", () => {
    const summary = summarizeTemplateValidation(
      createTemplate({
        googleDocLink: "https://docs.google.com/document/d/1originalTemplateId123456/edit",
        linkValidation: {
          googleDocLink: {
            status: "valid_google_doc",
            link: "https://docs.google.com/document/d/1originalTemplateId123456/edit",
            fileId: "1originalTemplateId123456",
            fileName: "Modelo Base",
            mimeType: "application/vnd.google-apps.document",
            validatedAt: "2026-04-12T00:00:00.000Z",
            error: null,
          },
        },
      })
    );

    expect(summary.health).toBe("ready_original");
    expect(summary.isSelectable).toBe(true);
    expect(summary.description).toContain("ainda não há fallback");
  });
});
