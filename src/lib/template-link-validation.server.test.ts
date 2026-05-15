import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateComposioClient, mockGetFileMetadata } = vi.hoisted(() => ({
  mockCreateComposioClient: vi.fn(),
  mockGetFileMetadata: vi.fn(),
}));

vi.mock("./composio-client", () => ({
  createComposioClient: mockCreateComposioClient,
}));

import { validateTemplateLinksForPersistence } from "./template-link-validation.server";

describe("validateTemplateLinksForPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateComposioClient.mockResolvedValue({
      getFileMetadata: mockGetFileMetadata,
    });
  });

  it("accepts a native Google Docs original link", async () => {
    mockGetFileMetadata.mockResolvedValue({
      id: "1nativeDocId123456",
      name: "Modelo Base",
      mimeType: "application/vnd.google-apps.document",
    });

    const result = await validateTemplateLinksForPersistence("token", {
      googleDocLink: "https://docs.google.com/document/d/1nativeDocId123456/edit",
      projectDocLink: "",
    });

    expect(result.canSave).toBe(true);
    expect(result.blockingErrors).toEqual([]);
    expect(result.validations.googleDocLink?.status).toBe("valid_google_doc");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("link customizado do projeto continua opcional"),
      ])
    );
  });

  it("blocks save when a populated link points to a DOCX file", async () => {
    mockGetFileMetadata.mockResolvedValue({
      id: "1wordDocId123456",
      name: "Declaracao.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await validateTemplateLinksForPersistence("token", {
      googleDocLink: "https://docs.google.com/document/d/1wordDocId123456/edit",
      projectDocLink: "",
    });

    expect(result.canSave).toBe(false);
    expect(result.validations.googleDocLink?.status).toBe("invalid_file_type");
    expect(result.blockingErrors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Converta-o para Google Docs nativo antes de salvar."),
      ])
    );
  });

  it("allows save with warning when one link is inaccessible but another is valid", async () => {
    mockGetFileMetadata.mockImplementation(async (fileId: string) => {
      if (fileId === "1originalId123456") {
        throw new Error("PERMISSION_DENIED: forbidden");
      }

      return {
        id: "1fallbackId123456",
        name: "Fallback Projeto",
        mimeType: "application/vnd.google-apps.document",
      };
    });

    const result = await validateTemplateLinksForPersistence("token", {
      googleDocLink: "https://docs.google.com/document/d/1originalId123456/edit",
      projectDocLink: "https://docs.google.com/document/d/1fallbackId123456/edit",
    });

    expect(result.canSave).toBe(true);
    expect(result.blockingErrors).toEqual([]);
    expect(result.validations.googleDocLink?.status).toBe("inaccessible");
    expect(result.validations.projectDocLink?.status).toBe("valid_google_doc");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("A geração continuará dependendo do outro link validado."),
      ])
    );
  });

  it("blocks save when no accessible native Google Docs remain", async () => {
    mockGetFileMetadata.mockRejectedValue(new Error("PERMISSION_DENIED: forbidden"));

    const result = await validateTemplateLinksForPersistence("token", {
      googleDocLink: "https://docs.google.com/document/d/1originalId123456/edit",
      projectDocLink: "https://docs.google.com/document/d/1fallbackId123456/edit",
    });

    expect(result.canSave).toBe(false);
    expect(result.blockingErrors).toEqual(
      expect.arrayContaining([expect.stringContaining("PERMISSION_DENIED")])
    );
  });
});
