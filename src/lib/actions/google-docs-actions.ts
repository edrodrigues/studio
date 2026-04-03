'use server';

import { generateContractInDocs } from '@/ai/flows/generate-contract-in-docs';
import { getDocumentPlaceholders } from '@/lib/google-docs';
import { copyFile, getFileMetadata } from '@/lib/google-drive';
import { extractPlaceholderDefinitionsFromText } from '@/lib/google-docs';

function buildUserFriendlyError(error: any) {
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
    } else if (errorMessage.includes('INVALID_TEMPLATE_TYPE')) {
        errorType = 'INVALID_TEMPLATE_TYPE';
        errorMessage = 'O link informado não aponta para um Google Docs editável';
        userInstructions = [
            'Use um link de Google Docs, não PDF ou outro tipo de arquivo',
            'Abra o documento e copie o link no formato docs.google.com/document/...'
        ];
    }

    return {
        error: errorMessage,
        errorType,
        userInstructions,
        technicalDetails: error.message,
    };
}

export async function inspectTemplateForGeneration(
    accessToken: string,
    templateFileId: string,
    fallbackMarkdownContent?: string
) {
    try {
        const metadata = await getFileMetadata(accessToken, templateFileId);

        if (metadata.mimeType !== 'application/vnd.google-apps.document') {
            throw new Error('INVALID_TEMPLATE_TYPE: O arquivo informado precisa ser um Google Docs.');
        }

        const googleDocPlaceholders = await getDocumentPlaceholders(accessToken, templateFileId);
        const fallbackPlaceholders = fallbackMarkdownContent
            ? extractPlaceholderDefinitionsFromText(fallbackMarkdownContent)
            : [];

        const placeholderMap = new Map<string, Set<string>>();

        for (const definition of [...googleDocPlaceholders, ...fallbackPlaceholders]) {
            if (!placeholderMap.has(definition.key)) {
                placeholderMap.set(definition.key, new Set<string>());
            }

            for (const match of definition.matches) {
                placeholderMap.get(definition.key)!.add(match);
            }
        }

        const placeholders = Array.from(placeholderMap.entries())
            .map(([key, matches]) => ({
                key,
                matches: Array.from(matches).sort(),
            }))
            .sort((a, b) => a.key.localeCompare(b.key));

        return {
            success: true,
            fileId: metadata.id,
            templateName: metadata.name,
            placeholders,
        };
    } catch (error: any) {
        console.error('Error inspecting Google Doc template:', error);
        return {
            success: false,
            ...buildUserFriendlyError(error),
        };
    }
}

/**
 * Server Action that orchestrates the Google Doc template copying and
 * deterministic placeholder filling.
 */
export async function generateContractDoc(
    accessToken: string,
    templateFileId: string,
    templateName: string,
    clientName: string,
    confirmedPlaceholders: Record<string, string>,
    placeholderMatches: Record<string, string[]>,
    projectId?: string
) {
    try {
        console.log(`Starting Google Doc generation for template ${templateFileId}`);

        const metadata = await getFileMetadata(accessToken, templateFileId);
        if (metadata.mimeType !== 'application/vnd.google-apps.document') {
            throw new Error('INVALID_TEMPLATE_TYPE: O arquivo informado precisa ser um Google Docs.');
        }

        const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const newFileName = `Contrato - ${templateName} - ${clientName} - ${dateStr}`;

        const newFileId = await copyFile(accessToken, templateFileId, newFileName);
        console.log(`Successfully copied template to new file: ${newFileId}`);

        const result = await generateContractInDocs({
            accessToken,
            documentId: newFileId,
            placeholderValues: confirmedPlaceholders,
            placeholderMatches,
            projectId
        });

        console.log(`Deterministic filling completed. Replacements applied: ${result.replacementsApplied}`);

        return {
            success: true,
            documentId: newFileId,
            documentLink: result.documentLink,
            replacementsApplied: result.replacementsApplied,
            fileName: newFileName
        };
    } catch (error: any) {
        console.error('Error in generateContractDoc Server Action:', error);
        return {
            success: false,
            ...buildUserFriendlyError(error),
        };
    }
}
