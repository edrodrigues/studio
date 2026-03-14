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
    extractedEntities: Record<string, any>,
    projectId?: string
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
            extractedEntities,
            projectId
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
        
        // Extrair mensagem de erro amigável
        let errorMessage = error.message || 'Failed to generate Google Doc';
        let errorType = 'UNKNOWN_ERROR';
        let userInstructions: string[] = [];
        
        if (errorMessage.includes('TEMPLATE_NOT_FOUND')) {
            errorType = 'TEMPLATE_NOT_FOUND';
            errorMessage = 'Template não encontrado no Google Drive';
            userInstructions = [
                'Verifique se o arquivo do template existe e não foi deletado',
                'Confirme se você tem permissão para acessar o arquivo',
                'Verifique se o link do template está correto na página de modelos'
            ];
        } else if (errorMessage.includes('PERMISSION_DENIED')) {
            errorType = 'PERMISSION_DENIED';
            errorMessage = 'Sem permissão para acessar o template';
            userInstructions = [
                'O arquivo deve ser compartilhado com você no Google Drive',
                'Verifique se está logado com a conta Google correta',
                'O proprietário do arquivo deve conceder permissão de leitura'
            ];
        } else if (errorMessage.includes('AUTH_EXPIRED')) {
            errorType = 'AUTH_EXPIRED';
            errorMessage = 'Sessão expirada';
            userInstructions = [
                'Faça logout e login novamente',
                'Verifique se sua conta Google está conectada'
            ];
        } else if (errorMessage.includes('INVALID_REQUEST')) {
            errorType = 'INVALID_REQUEST';
            errorMessage = 'ID do template inválido';
            userInstructions = [
                'Verifique o link do Google Docs na configuração do modelo',
                'O link deve ser um documento do Google Docs válido'
            ];
        }
        
        return {
            success: false,
            error: errorMessage,
            errorType,
            userInstructions,
            technicalDetails: error.message
        };
    }
}
