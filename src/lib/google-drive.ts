import { google } from 'googleapis';

/**
 * Copies a Google Drive file (like a Doc template) to create a new instance.
 * @param accessToken The user's OAuth access token.
 * @param fileId The ID of the file to copy.
 * @param newName The name for the new file.
 * @returns The ID of the newly created file.
 */
export async function copyFile(accessToken: string, fileId: string, newName: string): Promise<string> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    try {
        const response = await drive.files.copy({
            fileId: fileId,
            requestBody: {
                name: newName,
            },
        });
        
        if (!response.data.id) {
            throw new Error('Failed to copy file: No ID returned');
        }

        return response.data.id;
    } catch (error: any) {
        console.error('Error copying Google Drive file:', error);
        
        // Traduzir erros comuns do Google Drive para mensagens amigáveis
        const errorCode = error.code || error.status;
        const errorMessage = error.message || '';
        
        if (errorCode === 404 || errorMessage.includes('notFound') || errorMessage.includes('not found')) {
            throw new Error(`TEMPLATE_NOT_FOUND: O template não foi encontrado no Google Drive (ID: ${fileId}). Verifique se:
1. O arquivo existe e não foi deletado
2. Você tem permissão para acessá-lo
3. O link do template está correto`);
        }
        
        if (errorCode === 403 || errorMessage.includes('forbidden') || errorMessage.includes('Forbidden')) {
            throw new Error(`PERMISSION_DENIED: Sem permissão para acessar o template (ID: ${fileId}). Verifique se:
1. O arquivo foi compartilhado com você
2. Você está logado com a conta correta
3. O arquivo não está em modo restrito`);
        }
        
        if (errorCode === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('Invalid Credentials')) {
            throw new Error('AUTH_EXPIRED: Sessão expirada ou inválida. Por favor, faça login novamente com sua conta Google.');
        }
        
        if (errorCode === 400 || errorMessage.includes('badRequest') || errorMessage.includes('Invalid')) {
            throw new Error(`INVALID_REQUEST: ID do arquivo inválido (${fileId}). Verifique se o link do template está correto.`);
        }
        
        // Erro genérico com informações técnicas
        throw new Error(`GOOGLE_DRIVE_ERROR: Erro ao copiar template. ${errorMessage} (Código: ${errorCode || 'unknown'})`);
    }
}

/**
 * Shares a file with a specific email address.
 * @param accessToken The user's OAuth access token.
 * @param fileId The ID of the file to share.
 * @param email The email address to share with.
 * @param role The role to assign ('writer', 'commenter', 'reader').
 */
export async function shareFile(
    accessToken: string, 
    fileId: string, 
    email: string, 
    role: 'writer' | 'commenter' | 'reader' = 'writer'
): Promise<void> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    try {
        await drive.permissions.create({
            fileId,
            requestBody: {
                type: 'user',
                role,
                emailAddress: email,
            },
        });
    } catch (error: any) {
        console.error('Error sharing Google Drive file:', error);
        throw error;
    }
}
