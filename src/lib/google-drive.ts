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
        throw error;
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
