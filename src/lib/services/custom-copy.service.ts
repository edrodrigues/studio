import { detectPlaceholders, getUniquePlaceholderKeys, DetectedPlaceholder } from '../placeholder-detector';
import { matchEntitiesToPlaceholders } from '@/ai/flows/match-entities-to-placeholders';
import { getDocumentContent, batchUpdateDocument } from '../google-docs';
import { copyFile } from '../google-drive';
import { db } from '../firebase-server';
import { Project, ProjectDocument } from '../types';
import { genaiClient } from '../google-ai-stores';

export interface CustomCopyOptions {
  accessToken: string;
  projectId: string;
  templateId: string;
  newDocName: string;
}

export interface CustomCopyResult {
  success: boolean;
  newDocId: string;
  documentLink: string;
  placeholdersCount: number;
  matchesCount: number;
}

/**
 * Service to orchestrate the creation of a customized copy of a contract template.
 * 1. Read template content
 * 2. Detect placeholders
 * 3. Fetch project entities (from documents)
 * 4. Match placeholders to entities using IA
 * 5. Fallback to File Search for missing entities
 * 6. Create a copy of the template
 * 7. Apply substitutions
 */
export class CustomCopyService {
  /**
   * Uses File Search to find values for placeholders that weren't found in extracted entities.
   */
  private static async findMissingEntitiesWithFileSearch(
    projectId: string,
    missingPlaceholders: string[]
  ): Promise<Record<string, string>> {
    try {
      const projectDoc = await db.collection('projects').doc(projectId).get();
      const projectData = projectDoc.data();

      if (!projectData?.isSyncedToFileSearch || !projectData?.fileSearchStoreId) {
        return {};
      }

      const storeId = projectData.fileSearchStoreId;
      const foundEntities: Record<string, string> = {};

      // We ask Gemini to find specific information from the indexed documents
      const query = `A partir dos documentos deste projeto, encontre os seguintes valores para preenchimento de contrato:
${missingPlaceholders.join(', ')}

Retorne um JSON onde as chaves são os nomes solicitados e os valores são as informações encontradas nos documentos. Se não encontrar um valor, não inclua no JSON.`;

      const response = await genaiClient.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: query }] }],
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [storeId] } }],
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      });

      if (response.text) {
        try {
          const parsed = JSON.parse(response.text);
          Object.assign(foundEntities, parsed);
        } catch (e) {
          console.error('Error parsing File Search response:', e);
        }
      }

      return foundEntities;
    } catch (error) {
      console.error('Error in findMissingEntitiesWithFileSearch:', error);
      return {};
    }
  }

  /**
   * Orchestrates the complete flow of creating a customized copy.
   */
  static async createCustomizedCopy(options: CustomCopyOptions): Promise<CustomCopyResult> {
    const { accessToken, projectId, templateId, newDocName } = options;

    try {
      // 1. Get template content
      const content = await getDocumentContent(accessToken, templateId);
      
      // 2. Detect placeholders
      const detectedPlaceholders = detectPlaceholders(content);
      const uniqueKeys = getUniquePlaceholderKeys(detectedPlaceholders);
      
      if (uniqueKeys.length === 0) {
        // No placeholders found, just copy the file
        const newDocId = await copyFile(accessToken, templateId, newDocName);
        return {
          success: true,
          newDocId,
          documentLink: `https://docs.google.com/document/d/${newDocId}/edit`,
          placeholdersCount: 0,
          matchesCount: 0
        };
      }

      // 3. Fetch project entities
      // We aggregate all extracted entities from project documents
      const projectDoc = await db.collection('projects').doc(projectId).get();
      const project = projectDoc.data() as Project;
      
      const documentsSnapshot = await db.collection('projects').doc(projectId).collection('documents').get();
      const documents = documentsSnapshot.docs.map(doc => doc.data() as ProjectDocument);
      
      // Aggregate all entities
      const allEntities: Record<string, any> = {};
      documents.forEach(doc => {
        if (doc.extractedEntities) {
          Object.assign(allEntities, doc.extractedEntities);
        }
      });

      // 4. Match placeholders to entities via IA
      const matchResult = await matchEntitiesToPlaceholders({
        placeholders: uniqueKeys,
        entities: allEntities
      });

      // 5. Identify missing placeholders and try File Search
      const matchedPlaceholderKeys = new Set(matchResult.matches.map(m => m.placeholder));
      const missingKeys = uniqueKeys.filter(k => !matchedPlaceholderKeys.has(k));

      if (missingKeys.length > 0 && project.isSyncedToFileSearch) {
        const fileSearchEntities = await this.findMissingEntitiesWithFileSearch(projectId, missingKeys);
        
        // Add file search results to entities and matches
        for (const [key, value] of Object.entries(fileSearchEntities)) {
          const entityKey = `FS_${key.replace(/\s+/g, '_')}`;
          allEntities[entityKey] = value;
          matchResult.matches.push({
            placeholder: key,
            entityKey: entityKey,
            confidence: 'HIGH'
          });
        }
      }

      // 6. Create a copy of the template
      const newDocId = await copyFile(accessToken, templateId, newDocName);

      // 7. Apply substitutions
      const requests: any[] = [];
      let matchesCount = 0;

      // Map match results for easy lookup
      const keyToEntity = new Map<string, string>();
      matchResult.matches.forEach(m => {
        keyToEntity.set(m.placeholder, m.entityKey);
      });

      // Group detected placeholders by original text to avoid redundant replacements
      // (Google Docs replaceAllText handles all occurrences)
      const textToReplace = new Set<string>();
      
      detectedPlaceholders.forEach(p => {
        const entityKey = keyToEntity.get(p.normalizedKey);
        if (entityKey && allEntities[entityKey] !== undefined) {
          const value = String(allEntities[entityKey]);
          if (!textToReplace.has(p.originalText)) {
            requests.push({
              replaceAllText: {
                replaceText: value,
                containsText: {
                  text: p.originalText,
                  matchCase: false
                }
              }
            });
            textToReplace.add(p.originalText);
            matchesCount++;
          }
        }
      });

      if (requests.length > 0) {
        await batchUpdateDocument(accessToken, newDocId, requests);
      }

      return {
        success: true,
        newDocId,
        documentLink: `https://docs.google.com/document/d/${newDocId}/edit`,
        placeholdersCount: uniqueKeys.length,
        matchesCount
      };

    } catch (error) {
      console.error('Error in CustomCopyService:', error);
      throw error;
    }
  }
}
