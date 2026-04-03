import { google } from 'googleapis';
import { normalizeTemplateKey } from './utils';

export interface TemplatePlaceholderDefinition {
    key: string;
    matches: string[];
}

function createDocsClient(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.docs({ version: 'v1', auth });
}

function isLikelyHtmlTag(token: string): boolean {
    const normalizedToken = token.replace(/[<>{}\[\]]/g, '').trim().toUpperCase();
    const blockedTokens = new Set([
        'P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'DIV', 'SPAN',
        'TABLE', 'TR', 'TD', 'TH', 'THEAD', 'TBODY',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
        'A', 'IMG', 'IFRAME', 'SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'BODY', 'HTML'
    ]);

    const firstWord = normalizedToken.split(/\s+/)[0];
    return !normalizedToken || normalizedToken.startsWith('/') || blockedTokens.has(firstWord);
}

export function extractPlaceholderDefinitionsFromText(content: string): TemplatePlaceholderDefinition[] {
    const definitions = new Map<string, Set<string>>();
    const matches = content.match(/<<[^<>]+>>|{{[^{}]+}}|\[\[[^\]]+\]\]|<[^<>\s][^<>]*>/g) || [];

    for (const match of matches) {
        if (isLikelyHtmlTag(match)) {
            continue;
        }

        const normalizedKey = normalizeTemplateKey(match);
        if (!normalizedKey) {
            continue;
        }

        if (!definitions.has(normalizedKey)) {
            definitions.set(normalizedKey, new Set<string>());
        }

        definitions.get(normalizedKey)!.add(match);
    }

    return Array.from(definitions.entries())
        .map(([key, values]) => ({
            key,
            matches: Array.from(values).sort(),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Retrieves the full text content of a Google Doc.
 * @param accessToken The user's OAuth access token.
 * @param documentId The ID of the document.
 * @returns The document's text content.
 */
export async function getDocumentContent(accessToken: string, documentId: string): Promise<string> {
    const docs = createDocsClient(accessToken);

    try {
        const doc = await docs.documents.get({
            documentId,
        });

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

export async function getDocumentPlaceholders(
    accessToken: string,
    documentId: string
): Promise<TemplatePlaceholderDefinition[]> {
    const content = await getDocumentContent(accessToken, documentId);
    return extractPlaceholderDefinitionsFromText(content);
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
    const docs = createDocsClient(accessToken);

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
