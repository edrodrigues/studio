'use server';

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/**
 * Extracts text content from a .docx file buffer
 * @param buffer - The buffer of the .docx file
 * @returns Plain text content extracted from the document
 */
async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
    try {
        // Use mammoth to extract text from the .docx file
        const result = await mammoth.extractRawText({ buffer });

        if (result.messages.length > 0) {
            console.warn('Mammoth messages during extraction:', result.messages);
        }

        return result.value || 'Não foi possível extrair texto do documento.';
    } catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error('Falha ao extrair texto do documento Word.');
    }
}

/**
 * Extracts text content from an .xlsx file buffer
 * @param buffer - The buffer of the .xlsx file
 * @returns Plain text content extracted from the spreadsheet
 */
async function extractTextFromXlsxBuffer(buffer: Buffer): Promise<string> {
    try {
        // Use XLSX to read the buffer
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let fullText = '';

        // Iterate through all sheets to extract text
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            // Convert sheet to CSV format as it provides a good structured text representation for AI
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            if (csvData.trim()) {
                fullText += `--- Planilha: ${sheetName} ---\n${csvData}\n\n`;
            }
        });

        return fullText.trim() || 'Não foi possível extrair texto da planilha.';
    } catch (error) {
        console.error('Error extracting text from XLSX:', error);
        throw new Error('Falha ao extrair texto da planilha Excel.');
    }
}

/**
 * Converts a file buffer to supported text content
 * @param buffer - The file buffer
 * @param mimeType - The mime type of the file
 * @param filename - The filename (fallback for type detection)
 * @returns The converted text content
 */
/**
 * Validates file type by checking magic numbers (file signatures)
 * @param buffer - The file buffer
 * @returns Object with detected mime type and extension
 */
function detectFileType(buffer: Buffer): { mime: string; ext: string } {
    // Check magic numbers for common file types
    const signatures: Record<string, { mime: string; ext: string }> = {
        // ZIP-based formats (docx, xlsx)
        '504b0304': { mime: 'application/vnd.openxmlformats-officedocument', ext: 'zip' },
        // PDF
        '255044462d': { mime: 'application/pdf', ext: 'pdf' },
        // Older Office formats (doc, xls)
        'd0cf11e0a1b11ae1': { mime: 'application/msword', ext: 'doc' },
    };

    const hexHeader = buffer.slice(0, 8).toString('hex').toLowerCase();

    for (const [sig, info] of Object.entries(signatures)) {
        if (hexHeader.startsWith(sig)) {
            return info;
        }
    }

    // Try to detect text files
    const isText = buffer.slice(0, 1024).every(byte => byte === 0x0a || byte === 0x0d || byte === 0x09 || (byte >= 0x20 && byte <= 0x7e));
    if (isText) {
        return { mime: 'text/plain', ext: 'txt' };
    }

    return { mime: 'application/octet-stream', ext: '' };
}

export async function convertBufferToText(
    buffer: Buffer,
    mimeType: string,
    filename: string
): Promise<string> {
    // Detect actual file type from content
    const detectedType = detectFileType(buffer);

    // Use detected type if mime type is generic or doesn't match
    const effectiveMimeType = (mimeType === 'application/octet-stream' || !mimeType)
        ? detectedType.mime
        : mimeType;

    // Determine extension from filename as fallback
    const filenameExtension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
    const effectiveExtension = filenameExtension || detectedType.ext;

    // Priority 1: Check MIME type for known types (with validation)
    const isSpreadsheet = effectiveMimeType.includes('spreadsheet') ||
        effectiveMimeType.includes('excel') ||
        effectiveMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        effectiveExtension === 'xlsx' ||
        effectiveExtension === 'xls';

    if (isSpreadsheet) {
        // Additional validation: xlsx files should be valid ZIP archives
        if (detectedType.mime !== 'application/vnd.openxmlformats-officedocument' && effectiveExtension === 'xlsx') {
            throw new Error('Arquivo .xlsx inválido ou corrompido.');
        }
        return extractTextFromXlsxBuffer(buffer);
    }

    const isWordDoc = effectiveMimeType.includes('wordprocessing') ||
        effectiveMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        effectiveExtension === 'docx';

    if (isWordDoc) {
        // Additional validation: docx files should be valid ZIP archives
        if (detectedType.mime !== 'application/vnd.openxmlformats-officedocument' && effectiveExtension === 'docx') {
            throw new Error('Arquivo .docx inválido ou corrompido.');
        }
        return extractTextFromDocxBuffer(buffer);
    }

    // Priority 2: Handle text-based formats
    if (
        effectiveMimeType === 'text/plain' ||
        effectiveMimeType === 'text/markdown' ||
        effectiveExtension === 'txt' ||
        effectiveExtension === 'md' ||
        effectiveMimeType.startsWith('text/')
    ) {
        return buffer.toString('utf8');
    }

    if (effectiveExtension === 'doc' || detectedType.ext === 'doc') {
        throw new Error(
            'Arquivos .doc não são suportados. Por favor, converta para .docx ou .pdf primeiro.'
        );
    }

    // Special case for PDF: convertBufferToText shouldn't be called for PDF if we expect to keep it as PDF,
    // but if it is called, we should warn or handle it.
    if (effectiveMimeType === 'application/pdf' || effectiveExtension === 'pdf' || detectedType.ext === 'pdf') {
        throw new Error('Internal Error: PDF extraction is not supported in convertBufferToText. Use Geminis native PDF support.');
    }

    throw new Error(
        `Formato de arquivo não suportado: ${effectiveExtension ? '.' + effectiveExtension : 'sem extensão'}. Use .pdf, .docx, .txt, ou .md`
    );
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
    if (mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType === 'text/markdown') {
        return dataUri;
    }

    // Extract buffer from Data URI
    const base64Data = dataUri.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    const extractedText = await convertBufferToText(buffer, mimeType, filename);

    // Convert extracted text to a text/plain data URI
    const base64Text = Buffer.from(extractedText, 'utf8').toString('base64');
    return `data:text/plain;base64,${base64Text}`;
}

/**
 * Converts a Buffer to a supported Data URI format for Gemini
 */
export async function convertBufferToSupportedDataUri(
    buffer: Buffer,
    mimeType: string,
    filename: string
): Promise<string> {
    if (mimeType === 'application/pdf' || mimeType === 'text/plain') {
        // Return as is (base64 data uri)
        const base64 = buffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    }

    const extractedText = await convertBufferToText(buffer, mimeType, filename);
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
