import { google } from 'googleapis';

/**
 * Retrieves the full text content of a Google Doc.
 * @param accessToken The user's OAuth access token.
 * @param documentId The ID of the document.
 * @returns The document's text content.
 */
export async function getDocumentContent(accessToken: string, documentId: string): Promise<string> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const docs = google.docs({ version: 'v1', auth });

    try {
        const doc = await docs.documents.get({
            documentId,
        });

        // Basic extraction of text from the document body
        let content = '';
        const bodyContent = doc.data.body?.content;
        
        if (bodyContent) {
            bodyContent.forEach((element) => {
                if (element.paragraph) {
                    element.paragraph.elements?.forEach((el) => {
                        if (el.textRun?.content) {
                            content += el.textRun.content;
                        }
                    });
                } else if (element.table) {
                    element.table.tableRows?.forEach((row) => {
                        row.tableCells?.forEach((cell) => {
                            cell.content?.forEach((cellElement) => {
                                if (cellElement.paragraph) {
                                    cellElement.paragraph.elements?.forEach((el) => {
                                        if (el.textRun?.content) {
                                            content += el.textRun.content;
                                        }
                                    });
                                }
                            });
                        });
                    });
                }
            });
        }

        return content;
    } catch (error: any) {
        console.error('Error fetching Google Doc content:', error);
        throw error;
    }
}

/**
 * Applies a batch of updates to a Google Doc.
 * @param accessToken The user's OAuth access token.
 * @param documentId The ID of the document.
 * @param requests Array of batchUpdate requests.
 */
export async function batchUpdateDocument(
    accessToken: string, 
    documentId: string, 
    requests: any[]
): Promise<void> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const docs = google.docs({ version: 'v1', auth });

    try {
        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests,
            },
        });
    } catch (error: any) {
        console.error('Error updating Google Doc:', error);
        throw error;
    }
}
