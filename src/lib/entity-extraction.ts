import { db } from './firebase-server';
import { ProjectDocument } from './types';

export interface ExtractedEntity {
  key: string;
  value: string;
  confidence: number;
  sourceDocumentId: string;
  sourceDocumentName: string;
}

export interface EntityExtractionResult {
  success: boolean;
  entities?: Record<string, string>;
  entitiesByDocument?: Record<string, ExtractedEntity[]>;
  entityCount?: number;
  documentCount?: number;
  error?: string;
}

/**
 * Busca entidades extraídas de múltiplos documentos
 */
export async function extractEntitiesFromDocuments(
  documentIds: string[]
): Promise<Record<string, ExtractedEntity[]>> {
  console.log(`[EntityExtraction] Buscando entidades de ${documentIds.length} documentos`);
  
  const allEntities: Record<string, ExtractedEntity[]> = {};
  
  for (const docId of documentIds) {
    try {
      const docRef = db.collection('projectDocuments').doc(docId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        console.warn(`[EntityExtraction] Documento ${docId} não encontrado`);
        continue;
      }
      
      const docData = docSnap.data() as ProjectDocument;
      
      if (!docData.extractedEntities) {
        console.warn(`[EntityExtraction] Documento ${docId} (${docData.name}) não tem entidades extraídas`);
        continue;
      }
      
      // Converter entidades extraídas para formato padronizado
      const entities = Object.entries(docData.extractedEntities).map(([key, value]: [string, any]) => ({
        key,
        value: typeof value === 'object' ? value.value || value.text || JSON.stringify(value) : String(value),
        confidence: typeof value === 'object' ? value.confidence || 0.8 : 0.8,
        sourceDocumentId: docId,
        sourceDocumentName: docData.name
      }));
      
      allEntities[docId] = entities;
      console.log(`[EntityExtraction] ${entities.length} entidades encontradas em ${docData.name}`);
      
    } catch (error) {
      console.error(`[EntityExtraction] Erro ao processar documento ${docId}:`, error);
    }
  }
  
  return allEntities;
}

/**
 * Consolida entidades de múltiplos documentos em um único objeto
 * Resolve conflitos mantendo a entidade com maior confiança
 */
export function consolidateEntities(
  entitiesByDocument: Record<string, ExtractedEntity[]>
): Record<string, string> {
  const consolidated: Record<string, { value: string; confidence: number; source: string }> = {};
  const conflicts: Array<{ key: string; oldValue: string; newValue: string; reason: string }> = [];
  
  for (const [docId, entities] of Object.entries(entitiesByDocument)) {
    for (const entity of entities) {
      // Se já existe, compara confiança
      if (consolidated[entity.key]) {
        const existing = consolidated[entity.key];
        
        if (entity.confidence > existing.confidence) {
          conflicts.push({
            key: entity.key,
            oldValue: existing.value,
            newValue: entity.value,
            reason: `Maior confiança (${entity.confidence} > ${existing.confidence})`
          });
          consolidated[entity.key] = {
            value: entity.value,
            confidence: entity.confidence,
            source: entity.sourceDocumentName
          };
        } else {
          conflicts.push({
            key: entity.key,
            oldValue: entity.value,
            newValue: existing.value,
            reason: `Menor confiança (${entity.confidence} <= ${existing.confidence})`
          });
        }
      } else {
        consolidated[entity.key] = {
          value: entity.value,
          confidence: entity.confidence,
          source: entity.sourceDocumentName
        };
      }
    }
  }
  
  if (conflicts.length > 0) {
    console.log(`[EntityExtraction] ${conflicts.length} conflitos resolvidos:`, conflicts.slice(0, 5));
  }
  
  // Converter para formato simples
  const result: Record<string, string> = {};
  for (const [key, data] of Object.entries(consolidated)) {
    result[key] = data.value;
  }
  
  return result;
}

/**
 * Prepara dados completos para geração de contrato
 */
export async function prepareContractData(input: {
  projectId: string;
  documentIds: string[];
}): Promise<EntityExtractionResult> {
  try {
    console.log(`[prepareContractData] Preparando dados para projeto ${input.projectId} com ${input.documentIds.length} documentos`);
    
    if (input.documentIds.length === 0) {
      return {
        success: false,
        error: 'Nenhum documento selecionado'
      };
    }
    
    const entitiesByDoc = await extractEntitiesFromDocuments(input.documentIds);
    const consolidatedEntities = consolidateEntities(entitiesByDoc);
    const entityCount = Object.keys(consolidatedEntities).length;
    
    console.log(`[prepareContractData] ${entityCount} entidades consolidadas de ${input.documentIds.length} documentos`);
    
    return {
      success: true,
      entities: consolidatedEntities,
      entitiesByDocument: entitiesByDoc,
      entityCount,
      documentCount: input.documentIds.length
    };
  } catch (error) {
    console.error('[prepareContractData] Erro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao preparar dados do contrato'
    };
  }
}

/**
 * Verifica se documentos têm entidades extraídas
 */
export async function checkDocumentsHaveEntities(documentIds: string[]): Promise<{
  hasEntities: boolean;
  totalEntities: number;
  documentsWithEntities: number;
  documentsWithoutEntities: string[];
}> {
  const entitiesByDoc = await extractEntitiesFromDocuments(documentIds);
  
  let totalEntities = 0;
  const documentsWithEntities: string[] = [];
  const documentsWithoutEntities: string[] = [];
  
  for (const docId of documentIds) {
    const entities = entitiesByDoc[docId] || [];
    if (entities.length > 0) {
      totalEntities += entities.length;
      documentsWithEntities.push(docId);
    } else {
      documentsWithoutEntities.push(docId);
    }
  }
  
  return {
    hasEntities: totalEntities > 0,
    totalEntities,
    documentsWithEntities: documentsWithEntities.length,
    documentsWithoutEntities
  };
}
