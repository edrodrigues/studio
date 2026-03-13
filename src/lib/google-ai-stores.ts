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
 * Deleta um documento do File Search Store
 */
export async function deleteDocumentFromStore(documentName: string): Promise<boolean> {
  try {
    console.log(`[FileSearch] Deletando documento anterior: ${documentName}`);
    await genaiClient.files.delete({ name: documentName });
    console.log(`[FileSearch] Documento deletado com sucesso`);
    return true;
  } catch (error) {
    console.error(`[FileSearch] Erro ao deletar documento ${documentName}:`, error);
    // Não falha o processo se a deleção falhar - continua com o upload
    return false;
  }
}

/**
 * Faz o upload de um arquivo para o File Search Store do projeto
 * Se houver uma versão anterior (previousDocumentName), ela será deletada primeiro
 */
export async function uploadFileToProjectStore(
  projectId: string, 
  fileBuffer: Buffer, 
  fileName: string, 
  mimeType: string,
  previousDocumentName?: string
) {
  let tempFilePath = "";
  try {
    const storeId = await getOrCreateProjectStore(projectId);
    
    // Deletar versão anterior se existir
    if (previousDocumentName) {
      await deleteDocumentFromStore(previousDocumentName);
    }
    
    // Criar um arquivo temporário para o upload
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `upload_${Date.now()}_${fileName}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    console.log(`[FileSearch] Fazendo upload de ${fileName} para o store ${storeId}...`);

    const operation = await genaiClient.fileSearchStores.uploadToFileSearchStore({
      file: tempFilePath,
      fileSearchStoreName: storeId,
      config: {
        displayName: fileName,
        mimeType: mimeType
      }
    });

    const operationName = (operation as any).name || 'unknown';
    console.log(`[FileSearch] Upload iniciado. Operation name:`, operationName);

    // Aguardar a indexação completar (poll for completion)
    // CORREÇÃO: Atualizar a operação a cada poll para verificar o status real
    let currentOperation = operation;
    let pollCount = 0;
    const maxPolls = 60; // Max 60 * 2 seconds = 120 seconds (2 minutos)
    
    while (!(currentOperation as any).done && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      pollCount++;
      
      // CORREÇÃO: Buscar status atualizado da operação
      try {
        currentOperation = await genaiClient.operations.get({ 
          operation: currentOperation 
        }) as typeof operation;
        console.log(`[FileSearch] Poll ${pollCount}/${maxPolls}: status=${(currentOperation as any).done ? 'completed' : 'processing'}`);
      } catch (pollError) {
        console.warn(`[FileSearch] Poll ${pollCount}: erro ao verificar status:`, pollError);
      }
    }

    const indexingComplete = (currentOperation as any).done === true;
    const documentName = (currentOperation as any).response?.documentName || 
                        (currentOperation as any).documentName || 
                        null;

    if (!indexingComplete) {
      console.warn(`[FileSearch] Indexing not completed after ${pollCount * 2} seconds. Operation may still be processing.`);
    } else {
      console.log(`[FileSearch] Indexing completed successfully! Document: ${documentName}`);
    }

    return { 
      success: indexingComplete, // Só retorna sucesso se indexação completou
      storeId, 
      fileName,
      operationName,
      documentName,
      indexingComplete,
      error: indexingComplete ? undefined : 'Indexing timeout - operation still processing'
    };
  } catch (error) {
    console.error(`[FileSearch] Erro ao sincronizar arquivo ${fileName}:`, error);
    return { 
      success: false, 
      error: (error as Error).message,
      storeId: undefined,
      fileName,
      operationName: undefined,
      documentName: undefined,
      indexingComplete: false
    };
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
