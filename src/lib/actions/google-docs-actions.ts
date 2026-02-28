'use server';

import { copyFile } from '@/lib/google-drive';
import { generateContractInDocs } from '@/ai/flows/generate-contract-in-docs';

/**
 * Server Action that orchestrates the Google Doc template copying and AI filling.
 * @param accessToken The user's OAuth access token.
 * @param templateFileId The Google Drive File ID of the template.
 * @param templateName The name of the template (for naming the copy).
 * @param clientName The name of the client (for naming the copy).
 * @param extractedEntities The JSON object with extracted values.
 * @returns The generated document information.
 */
export async function generateContractDoc(
    accessToken: string,
    templateFileId: string,
    templateName: string,
    clientName: string,
    extractedEntities: Record<string, any>
) {
    try {
        console.log(`Starting Google Doc generation for template ${templateFileId}`);
        
        // 1. Copy the template in the user's Google Drive
        const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const newFileName = `Contrato - ${templateName} - ${clientName} - ${dateStr}`;
        
        const newFileId = await copyFile(accessToken, templateFileId, newFileName);
        console.log(`Successfully copied template to new file: ${newFileId}`);
        
        // 2. Fill the copy using AI via the Genkit flow
        const result = await generateContractInDocs({
            accessToken,
            documentId: newFileId,
            extractedEntities
        });
        
        console.log(`AI filling completed. Replacements applied: ${result.replacementsApplied}`);
        
        return {
            success: true,
            documentId: newFileId,
            documentLink: result.documentLink,
            replacementsApplied: result.replacementsApplied,
            fileName: newFileName
        };
    } catch (error: any) {
        console.error('Error in generateContractDoc Server Action:', error);
        throw new Error(error.message || 'Failed to generate Google Doc');
    }
}
