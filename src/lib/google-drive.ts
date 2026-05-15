import { google } from 'googleapis';

export interface GoogleDriveFileMetadata {
    id: string;
    name: string;
    mimeType: string;
}

function createDriveClient(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth });
}

function mapGoogleDriveError(error: any, fileId: string): Error {
    const errorCode = error.code || error.status;
    const errorMessage = error.message || '';

    if (errorCode === 404 || errorMessage.includes('notFound') || errorMessage.includes('not found')) {
        return new Error(`TEMPLATE_NOT_FOUND: O template não foi encontrado no Google Drive (ID: ${fileId}). Verifique se:
1. O arquivo existe e não foi deletado
2. Você tem permissão para acessá-lo
3. O link do template está correto`);
    }

    if (errorCode === 403 || errorMessage.includes('forbidden') || errorMessage.includes('Forbidden')) {
        return new Error(`PERMISSION_DENIED: Sem permissão para acessar o template (ID: ${fileId}). Verifique se:
1. O arquivo foi compartilhado com você
2. Você está logado com a conta correta
3. O arquivo não está em modo restrito`);
    }

    if (errorCode === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('Invalid Credentials')) {
        return new Error('AUTH_EXPIRED: Sessão expirada ou inválida. Por favor, faça login novamente com sua conta Google.');
    }

    if (errorCode === 400 || errorMessage.includes('badRequest') || errorMessage.includes('Invalid')) {
        return new Error(`INVALID_REQUEST: ID do arquivo inválido (${fileId}). Verifique se o link do template está correto.`);
    }

    return new Error(`GOOGLE_DRIVE_ERROR: Erro ao acessar template. ${errorMessage} (Código: ${errorCode || 'unknown'})`);
}

export async function getFileMetadata(
    accessToken: string,
    fileId: string
): Promise<GoogleDriveFileMetadata> {
    const drive = createDriveClient(accessToken);

    try {
        const response = await drive.files.get({
            fileId,
            fields: 'id,name,mimeType',
            supportsAllDrives: true,
        });

        if (!response.data.id || !response.data.name || !response.data.mimeType) {
            throw new Error('GOOGLE_DRIVE_ERROR: Metadados incompletos do template.');
        }

        return {
            id: response.data.id,
            name: response.data.name,
            mimeType: response.data.mimeType,
        };
    } catch (error: any) {
        console.error('Error fetching Google Drive file metadata:', error);
        throw mapGoogleDriveError(error, fileId);
    }
}

/**
 * Copies a Google Drive file (like a Doc template) to create a new instance.
 * @param accessToken The user's OAuth access token.
 * @param fileId The ID of the file to copy.
 * @param newName The name for the new file.
 * @returns The ID of the newly created file.
 */
export async function copyFile(accessToken: string, fileId: string, newName: string): Promise<string> {
    const drive = createDriveClient(accessToken);

    try {
        await getFileMetadata(accessToken, fileId);

        const response = await drive.files.copy({
            fileId,
            requestBody: {
                name: newName,
            },
            supportsAllDrives: true,
        });

        if (!response.data.id) {
            throw new Error('Failed to copy file: No ID returned');
        }

        return response.data.id;
    } catch (error: any) {
        console.error('Error copying Google Drive file:', error);
        throw mapGoogleDriveError(error, fileId);
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
    const drive = createDriveClient(accessToken);

    try {
        await drive.permissions.create({
            fileId,
            requestBody: {
                type: 'user',
                role,
                emailAddress: email,
            },
            supportsAllDrives: true,
        });
    } catch (error: any) {
        console.error('Error sharing Google Drive file:', error);
        throw mapGoogleDriveError(error, fileId);
    }
}
