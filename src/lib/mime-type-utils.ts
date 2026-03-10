const SUPPORTED_FILE_SEARCH_MIME_TYPES: Record<string, string> = {
  'text/plain': ['.txt', '.text'],
  'text/markdown': ['.md', '.markdown'],
  'application/pdf': ['.pdf'],
  'text/html': ['.html', '.htm'],
};

const MIME_TYPE_MAP: Record<string, string> = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.rtf': 'text/rtf',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
};

export function getValidMimeType(fileName: string, browserMimeType?: string): string {
  const ext = (fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  const mappedMimeType = MIME_TYPE_MAP[ext];

  if (mappedMimeType && SUPPORTED_FILE_SEARCH_MIME_TYPES[mappedMimeType]) {
    return mappedMimeType;
  }

  if (browserMimeType && SUPPORTED_FILE_SEARCH_MIME_TYPES[browserMimeType]) {
    return browserMimeType;
  }

  if (ext === '.pdf') {
    return 'application/pdf';
  }

  return 'text/plain';
}
