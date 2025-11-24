'use server';

/**
 * Extracts text content from a .docx file (data URI)
 * @param dataUri - The data URI of the .docx file
 * @returns Plain text content extracted from the document
 */
async function extractTextFromDocx(dataUri: string): Promise<string> {
    try {
        // Convert data URI to buffer
        const base64Data = dataUri.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // Use adm-zip to extract text from the .docx file
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        let text = '';

        // Look for document.xml which contains the main content
        const documentXml = zipEntries.find((entry: any) =>
            entry.entryName === 'word/document.xml'
        );

        if (documentXml) {
            const content = documentXml.getData().toString('utf8');

            // Extract text from XML tags (simple approach)
            // This regex extracts content between <w:t> tags which contain text in docx
            const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);

            if (textMatches) {
                text = textMatches
                    .map((match: string) => {
                        const textContent = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
                        return textContent;
                    })
                    .join(' ');
            }
        }

        return text || 'Não foi possível extrair texto do documento.';
    } catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error('Falha ao extrair texto do documento Word.');
    }
}

/**
 * Extracts text content from an .xlsx file (data URI)
 * @param dataUri - The data URI of the .xlsx file
 * @returns Plain text content extracted from the spreadsheet
 */
async function extractTextFromXlsx(dataUri: string): Promise<string> {
    try {
        // For Excel files, we'll extract basic text content
        const base64Data = dataUri.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        const AdmZip = require('adm-zip');
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        let text = '';

        // Look for sharedStrings.xml which contains text values
        const sharedStrings = zipEntries.find((entry: any) =>
            entry.entryName === 'xl/sharedStrings.xml'
        );

        if (sharedStrings) {
            const content = sharedStrings.getData().toString('utf8');

            // Extract text from <t> tags
            const textMatches = content.match(/<t[^>]*>([^<]+)<\/t>/g);

            if (textMatches) {
                text = textMatches
                    .map((match: string) => {
                        const textContent = match.replace(/<t[^>]*>/, '').replace(/<\/t>/, '');
                        return textContent;
                    })
                    .join('\n');
            }
        }

        return text || 'Não foi possível extrair texto da planilha.';
    } catch (error) {
        console.error('Error extracting text from XLSX:', error);
        throw new Error('Falha ao extrair texto da planilha Excel.');
    }
}

/**
 * Converts a data URI to plain text data URI if the MIME type is not supported by Gemini API
 * Supported MIME types: application/pdf, text/plain
 * @param dataUri - The original data URI
 * @param filename - The original filename (used to determine file type)
 * @returns A data URI that is compatible with Gemini API
 */
export async function convertToSupportedFormat(
    dataUri: string,
    filename: string
): Promise<string> {
    // Extract MIME type from data URI
    const mimeTypeMatch = dataUri.match(/^data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : '';

    // Check if it's already a supported format
    if (mimeType === 'application/pdf' || mimeType === 'text/plain') {
        return dataUri;
    }

    // Handle different file types
    const extension = filename.split('.').pop()?.toLowerCase();

    let extractedText = '';

    switch (extension) {
        case 'docx':
            extractedText = await extractTextFromDocx(dataUri);
            break;

        case 'doc':
            // .doc files are more complex (binary format), provide a helpful message
            throw new Error(
                'Arquivos .doc não são suportados. Por favor, converta para .docx ou .pdf primeiro.'
            );

        case 'xlsx':
        case 'xls':
            extractedText = await extractTextFromXlsx(dataUri);
            break;

        case 'txt':
        case 'md':
            // These should already be text/plain, but if not, extract the text
            const base64Data = dataUri.split(',')[1];
            extractedText = Buffer.from(base64Data, 'base64').toString('utf8');
            break;

        default:
            throw new Error(
                `Formato de arquivo não suportado: .${extension}. Use .pdf, .docx, .txt, ou .md`
            );
    }

    // Convert extracted text to a text/plain data URI
    const base64Text = Buffer.from(extractedText, 'utf8').toString('base64');
    return `data:text/plain;base64,${base64Text}`;
}

/**
 * Converts an array of document objects to supported formats
 * @param documents - Array of documents with name and dataUri
 * @returns Array of documents with converted dataUris
 */
export async function convertDocumentsToSupportedFormats(
    documents: { name: string; dataUri: string }[]
): Promise<{ name: string; dataUri: string }[]> {
    const convertedDocuments = await Promise.all(
        documents.map(async (doc) => {
            try {
                const convertedDataUri = await convertToSupportedFormat(
                    doc.dataUri,
                    doc.name
                );
                return { ...doc, dataUri: convertedDataUri };
            } catch (error) {
                console.error(`Error converting document ${doc.name}:`, error);
                throw error;
            }
        })
    );

    return convertedDocuments;
}
