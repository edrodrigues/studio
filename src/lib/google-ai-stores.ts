import { GoogleGenAI } from "@google/genai";
import { db } from "./firebase-server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Inicializa o cliente do Google GenAI (Unified SDK)
export const genaiClient = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
  vertexai: false // Usando a API direta da ML Dev (AI Studio)
});

/**
 * Obtém ou cria um File Search Store para o projeto no Google
 */
export async function getOrCreateProjectStore(projectId: string) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  
  const data = projectDoc.exists ? projectDoc.data() : null;
  if (data?.fileSearchStoreId) {
    return data.fileSearchStoreId;
  }

  console.log(`Criando novo File Search Store para o projeto: ${projectId}`);
  
  try {
    const fileSearchStore = await genaiClient.fileSearchStores.create({
      config: {
        displayName: `Store_Project_${projectId}`
      }
    });

    const storeId = fileSearchStore.name;

    if (projectDoc.exists) {
      await projectRef.update({
        fileSearchStoreId: storeId,
        updatedAt: new Date()
      });
    }

    return storeId;
  } catch (error) {
    console.error("Erro ao criar File Search Store no Google:", error);
    throw new Error("Falha ao inicializar repositório de busca do Google.");
  }
}

/**
 * Faz o upload de um arquivo para o File Search Store do projeto
 */
export async function uploadFileToProjectStore(projectId: string, fileBuffer: Buffer, fileName: string, mimeType: string) {
  let tempFilePath = "";
  try {
    const storeId = await getOrCreateProjectStore(projectId);
    
    // Criar um arquivo temporário para o upload
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `upload_${Date.now()}_${fileName}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    console.log(`Fazendo upload de ${fileName} para o store ${storeId}...`);

    const operation = await genaiClient.fileSearchStores.uploadToFileSearchStore({
      file: tempFilePath,
      fileSearchStoreName: storeId,
      config: {
        displayName: fileName,
        mimeType: mimeType
      }
    });

    console.log(`Upload iniciado. Operation name:`, (operation as any).name || 'unknown');

    // Aguardar a indexação completar (poll for completion)
    let pollCount = 0;
    const maxPolls = 30; // Max 30 * 2 seconds = 60 seconds
    
    while (!(operation as any).done && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      pollCount++;
      console.log(`[FileSearch] Poll ${pollCount}: indexing in progress...`);
    }

    if (!(operation as any).done) {
      console.warn(`[FileSearch] Indexing not completed after ${pollCount * 2} seconds, returning anyway`);
    } else {
      console.log(`[FileSearch] Indexing completed successfully!`);
    }

    return { 
      success: true, 
      storeId, 
      fileName,
      operationName: (operation as any).name,
      indexingComplete: (operation as any).done
    };
  } catch (error) {
    console.error(`Erro ao sincronizar arquivo ${fileName}:`, error);
    return { success: false, error: (error as Error).message };
  } finally {
    // Limpar arquivo temporário
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Silencioso
      }
    }
  }
}
