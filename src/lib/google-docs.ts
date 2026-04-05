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

function mapGoogleDocsError(error: any, documentId: string): Error {
    const errorCode = error.code || error.status;
    const errorMessage = error.message || '';

    if (errorCode === 404 || errorMessage.includes('notFound') || errorMessage.includes('not found')) {
        return new Error(`TEMPLATE_NOT_FOUND: O documento não foi encontrado no Google Docs (ID: ${documentId}). Verifique se:
1. O arquivo existe e não foi deletado
2. Você tem permissão para acessá-lo
3. O link do documento está correto`);
    }

    if (errorCode === 403 || errorMessage.includes('forbidden') || errorMessage.includes('Forbidden')) {
        return new Error(`PERMISSION_DENIED: Sem permissão para acessar o documento (ID: ${documentId}). Verifique se:
1. O arquivo foi compartilhado com você
2. Você está logado com a conta correta
3. O arquivo não está em modo restrito`);
    }

    if (errorCode === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('Invalid Credentials')) {
        return new Error('AUTH_EXPIRED: Sessão expirada ou inválida. Por favor, faça login novamente com sua conta Google.');
    }

    if (errorCode === 400 || errorMessage.includes('badRequest') || errorMessage.includes('Invalid')) {
        return new Error(`INVALID_REQUEST: ID do documento inválido (${documentId}). Verifique se o link do documento está correto.`);
    }

    if (errorCode === 429 || errorMessage.includes('rateLimitExceeded') || errorMessage.includes('Rate limit')) {
        return new Error('RATE_LIMITED: Muitas requisições ao Google Docs. Aguarde alguns segundos e tente novamente.');
    }

    return new Error(`GOOGLE_DOCS_ERROR: Erro ao acessar documento. ${errorMessage} (Código: ${errorCode || 'unknown'})`);
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
        throw mapGoogleDocsError(error, documentId);
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
        throw mapGoogleDocsError(error, documentId);
    }
}
