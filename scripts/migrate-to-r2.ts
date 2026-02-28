import { config } from 'dotenv';
config({ path: '.env.local' });

import { getR2Client, R2_BUCKET_NAME } from '../src/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { ProjectDocument } from '../src/lib/types';
import { execSync } from 'child_process';

/**
 * Migration script to move existing files from Firebase Storage to Cloudflare R2.
 * Uses Firestore REST API with gcloud token to avoid requiring a service account file.
 */
async function migrateToR2() {
  console.log('🚀 Iniciando migração para Cloudflare R2...');

  try {
    // 1. Get access token from gcloud
    let token: string;
    try {
      token = execSync('gcloud auth print-access-token').toString().trim();
    } catch (e) {
      throw new Error('Falha ao obter token do Google Cloud. Certifique-se de que o gcloud CLI está instalado e você está logado (gcloud auth login).');
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID não encontrado no .env.local');

    // 2. Fetch documents from Firestore via REST
    console.log('⏳ Buscando documentos no Firestore...');
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/projectDocuments`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        console.log('ℹ️ Nenhuma coleção "projectDocuments" encontrada ou está vazia.');
        return;
      }
      throw new Error(`Falha ao buscar documentos: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json() as any;
    
    if (!data.documents || data.documents.length === 0) {
      console.log('📦 Nenhum documento encontrado para migrar.');
      return;
    }

    // Firestore REST API returns documents in a specific format
    const documents = data.documents.map((doc: any) => {
      const fields = doc.fields;
      const result: any = { id: doc.name.split('/').pop() };
      for (const key in fields) {
        const valueObj = fields[key];
        if (valueObj.stringValue) result[key] = valueObj.stringValue;
        else if (valueObj.integerValue) result[key] = parseInt(valueObj.integerValue);
        else if (valueObj.booleanValue !== undefined) result[key] = valueObj.booleanValue;
        else if (valueObj.timestampValue) result[key] = valueObj.timestampValue;
      }
      return result as ProjectDocument & { id: string };
    });

    const docsToMigrate = documents.filter(doc => doc.storageProvider !== 'r2');
    
    if (docsToMigrate.length === 0) {
      console.log('✅ Todos os documentos já estão no Cloudflare R2.');
      return;
    }

    console.log(`📦 Encontrados ${docsToMigrate.length} documentos para migrar.`);

    let successCount = 0;
    let failCount = 0;

    const r2Client = getR2Client();

    for (const docData of docsToMigrate) {
      try {
        console.log(`⏳ Migrando: ${docData.name} (${docData.id})...`);

        // 3. Download from Firebase (via public URL)
        if (!docData.fileUrl) {
          console.warn(`⚠️ Pulando ${docData.name}: URL do arquivo ausente.`);
          continue;
        }

        const fileResponse = await fetch(docData.fileUrl);
        if (!fileResponse.ok) throw new Error(`Falha ao baixar do Firebase: ${fileResponse.statusText}`);
        
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 4. Upload to R2
        const command = new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: docData.storagePath,
          Body: buffer,
          ContentType: docData.mimeType,
        });

        await r2Client.send(command);

        // 5. Update Firestore via REST (PATCH)
        const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/projectDocuments/${docData.id}?updateMask.fieldPaths=storageProvider&updateMask.fieldPaths=updatedAt`;
        
        const patchResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              ...data.documents.find((d: any) => d.name.endsWith(docData.id)).fields,
              storageProvider: { stringValue: 'r2' },
              updatedAt: { stringValue: new Date().toISOString() }
            }
          })
        });

        if (!patchResponse.ok) {
          throw new Error(`Falha ao atualizar Firestore: ${patchResponse.statusText}`);
        }

        console.log(`✅ Sucesso: ${docData.name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Falha ao migrar ${docData.name}:`, error);
        failCount++;
      }
    }

    console.log('\n--- Resumo da Migração ---');
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falha: ${failCount}`);
    console.log(`📦 Total Processado: ${docsToMigrate.length}`);
    console.log('--------------------------');

  } catch (error) {
    console.error('💥 Erro fatal durante a migração:', error);
  }
}

migrateToR2();
