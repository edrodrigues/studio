#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const admin = require("firebase-admin");
const { google } = require("googleapis");

const GOOGLE_DOCS_MIME_TYPE = "application/vnd.google-apps.document";
const CONVERTIBLE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
]);

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.warn(
        "[backfill-template-link-validation] FIREBASE_SERVICE_ACCOUNT inválido no ambiente, tentando arquivos locais..."
      );
    }
  }

  const candidatePaths = [
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    "./studio-7861892440-bca98-firebase-adminsdk-fbsvc-3b40677087.json",
    "./google-service-account.json",
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    const absolutePath = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(absolutePath)) {
      return require(absolutePath);
    }
  }

  throw new Error("Nenhuma credencial de service account foi encontrada para o backfill.");
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
}

const db = admin.firestore();

const auth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

function extractGoogleDocId(link) {
  if (!link) return null;
  const stringLink = String(link).trim();
  const match = stringLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(stringLink)) return stringLink;
  return null;
}

function buildValidation(status, link, extras = {}) {
  return {
    status,
    link: String(link || "").trim(),
    validatedAt: new Date().toISOString(),
    ...extras,
  };
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function validateLink(link, label) {
  const trimmedLink = String(link || "").trim();

  if (!trimmedLink) {
    return buildValidation("missing", trimmedLink, {
      error: label === "projectDocLink" ? null : "O link original ainda não foi preenchido.",
    });
  }

  const fileId = extractGoogleDocId(trimmedLink);
  if (!fileId) {
    return buildValidation("invalid_format", trimmedLink, {
      fileId: null,
      error: `${label}: o link não contém um Google Docs válido.`,
    });
  }

  try {
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,webViewLink",
      supportsAllDrives: true,
    });
    const data = meta.data;

    if (data.mimeType !== GOOGLE_DOCS_MIME_TYPE) {
      return buildValidation("invalid_file_type", trimmedLink, {
        fileId: data.id,
        fileName: data.name,
        mimeType: data.mimeType,
        error: `${label}: o arquivo "${data.name}" tem tipo "${data.mimeType}".`,
      });
    }

    return buildValidation("valid_google_doc", trimmedLink, {
      fileId: data.id,
      fileName: data.name,
      mimeType: data.mimeType,
      error: null,
    });
  } catch (error) {
    return buildValidation("inaccessible", trimmedLink, {
      fileId,
      error: `${label}: ${error.message || "não foi possível acessar o arquivo no Google Drive."}`,
    });
  }
}

async function copyPermissions(sourceFileId, targetFileId) {
  try {
    const response = await drive.permissions.list({
      fileId: sourceFileId,
      fields: "permissions(type,role,emailAddress,domain,allowFileDiscovery)",
      supportsAllDrives: true,
    });

    for (const permission of response.data.permissions || []) {
      if (permission.role === "owner") {
        continue;
      }

      const requestBody = {
        type: permission.type,
        role: permission.role,
      };

      if (permission.emailAddress) {
        requestBody.emailAddress = permission.emailAddress;
      }
      if (permission.domain) {
        requestBody.domain = permission.domain;
      }
      if (typeof permission.allowFileDiscovery === "boolean") {
        requestBody.allowFileDiscovery = permission.allowFileDiscovery;
      }

      try {
        await drive.permissions.create({
          fileId: targetFileId,
          requestBody,
          supportsAllDrives: true,
          sendNotificationEmail: false,
        });
      } catch (permissionError) {
        console.warn(
          `[backfill-template-link-validation] Falha ao copiar permissão ${permission.type}/${permission.role} para ${targetFileId}:`,
          permissionError.message || permissionError
        );
      }
    }
  } catch (error) {
    console.warn(
      `[backfill-template-link-validation] Não foi possível copiar permissões do arquivo ${sourceFileId}:`,
      error.message || error
    );
  }
}

async function convertFileToGoogleDocs(sourceFileId) {
  const sourceMeta = await drive.files.get({
    fileId: sourceFileId,
    fields: "id,name,mimeType,parents,copyRequiresWriterPermission",
    supportsAllDrives: true,
  });

  const source = sourceMeta.data;
  if (!CONVERTIBLE_MIME_TYPES.has(source.mimeType)) {
    throw new Error(`Tipo ${source.mimeType} não é suportado para conversão automática.`);
  }

  const download = await drive.files.get(
    { fileId: sourceFileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );

  const buffer = await streamToBuffer(download.data);
  const requestBody = {
    name: source.name.replace(/\.[^.]+$/u, ""),
    mimeType: GOOGLE_DOCS_MIME_TYPE,
  };

  if (Array.isArray(source.parents) && source.parents.length > 0) {
    requestBody.parents = source.parents;
  }

  const created = await drive.files.create({
    requestBody,
    media: {
      mimeType: source.mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,name,webViewLink,mimeType",
    supportsAllDrives: true,
  });

  await copyPermissions(sourceFileId, created.data.id);

  if (source.copyRequiresWriterPermission === false) {
    try {
      await drive.files.update({
        fileId: created.data.id,
        requestBody: {
          copyRequiresWriterPermission: false,
        },
        supportsAllDrives: true,
      });
    } catch (error) {
      console.warn(
        `[backfill-template-link-validation] Não foi possível ajustar copyRequiresWriterPermission para ${created.data.id}:`,
        error.message || error
      );
    }
  }

  return {
    id: created.data.id,
    webViewLink: created.data.webViewLink || `https://docs.google.com/document/d/${created.data.id}/edit`,
    name: created.data.name,
  };
}

async function maybeRepairTemplate(template) {
  const googleValidation = await validateLink(template.googleDocLink, "googleDocLink");
  const customValidation = await validateLink(template.projectDocLink, "projectDocLink");

  if (
    googleValidation.status === "invalid_file_type" &&
    !template.projectDocLink &&
    googleValidation.fileId &&
    CONVERTIBLE_MIME_TYPES.has(googleValidation.mimeType)
  ) {
    try {
      console.log(
        `[backfill-template-link-validation] Convertendo template quebrado "${template.name}" para Google Docs nativo...`
      );
      const converted = await convertFileToGoogleDocs(googleValidation.fileId);
      template.googleDocLink = converted.webViewLink;
      console.log(
        `[backfill-template-link-validation] Template "${template.name}" corrigido para ${converted.webViewLink}`
      );
    } catch (error) {
      console.warn(
        `[backfill-template-link-validation] Conversão automática indisponível para "${template.name}":`,
        error.message || error
      );
    }
  }

  const refreshedGoogleValidation = await validateLink(template.googleDocLink, "googleDocLink");
  const refreshedCustomValidation = await validateLink(template.projectDocLink, "projectDocLink");

  return {
    googleDocLink: template.googleDocLink || "",
    projectDocLink: template.projectDocLink || "",
    linkValidation: {
      googleDocLink: refreshedGoogleValidation,
      projectDocLink: refreshedCustomValidation,
    },
  };
}

async function main() {
  const snapshot = await db.collection("contractModels").get();
  const templates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const summary = {
    checked: templates.length,
    updated: 0,
    converted: 0,
    failed: 0,
  };

  for (const template of templates) {
    try {
      const originalGoogleLink = template.googleDocLink || "";
      const update = await maybeRepairTemplate({ ...template });

      if (update.googleDocLink !== originalGoogleLink) {
        summary.converted += 1;
      }

      await db.collection("contractModels").doc(template.id).update(update);
      summary.updated += 1;
      console.log(
        `[backfill-template-link-validation] ${template.name}: google=${update.linkValidation.googleDocLink.status} custom=${update.linkValidation.projectDocLink.status}`
      );
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[backfill-template-link-validation] Falha ao processar "${template.name}":`,
        error.message || error
      );
    }
  }

  console.log("[backfill-template-link-validation] Resumo:", summary);
}

main().catch((error) => {
  console.error("[backfill-template-link-validation] Erro fatal:", error);
  process.exit(1);
});
