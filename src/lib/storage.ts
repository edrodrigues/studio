import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword', // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.ms-excel', // XLS
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'text/plain',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];

const BLOCKED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
];

export interface UploadProgress {
  progress: number;
  state: 'running' | 'paused' | 'success' | 'error';
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageError extends Error {
  code?: string;
}

/**
 * Validates file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo permitido: 100MB. Seu arquivo tem: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }

  // Check if file is an image (not supported)
  if (BLOCKED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Formato de arquivo não suportado. Envie apenas arquivos PDF, DOC, DOCX, XLS, XLSX ou TXT. Imagens (PNG, JPG, etc.) não são aceitas.`
    };
  }

  // Check if file type is explicitly allowed
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    // Allow if extension suggests it might be a supported format
    const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return {
        valid: false,
        error: `Tipo de arquivo não suportado. Tipos aceitos: PDF, DOC, DOCX, XLS, XLSX, TXT.`
      };
    }
  }

  return { valid: true };
}

/**
 * Generates storage path for a document
 */
export function generateStoragePath(
  projectId: string,
  documentType: string,
  fileName: string,
  version: number
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  return `projects/${projectId}/documents/${documentType}/v${version}_${timestamp}_${sanitizedFileName}`;
}

/**
 * Translates Firebase Storage error codes to user-friendly messages
 */
export function getStorageErrorMessage(error: any): string {
  const code = error?.code || error?.message;
  
  switch (code) {
    case 'storage/unauthorized':
      return 'Você não tem permissão para fazer upload de arquivos. Verifique se você é membro do projeto com permissão de edição.';
    case 'storage/canceled':
      return 'Upload cancelado pelo usuário.';
    case 'storage/quota-exceeded':
      return 'Limite de armazenamento excedido. Entre em contato com o administrador.';
    case 'storage/invalid-format':
      return 'Formato de arquivo inválido.';
    case 'storage/server-file-wrong-size':
      return 'O arquivo enviado não corresponde ao tamanho esperado.';
    default:
      if (code?.includes('network')) {
        return 'Erro de conexão. Verifique sua internet e tente novamente.';
      }
      return 'Erro ao fazer upload do arquivo. Tente novamente.';
  }
}

/**
 * Uploads a file to Firebase Storage with progress tracking
 */
export function uploadFileToStorage(
  file: File,
  storagePath: string,
  storage: FirebaseStorage,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      const error = new Error(validation.error);
      (error as StorageError).code = 'file/too-large';
      reject(error);
      return;
    }

    try {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.({
            progress,
            state: snapshot.state as UploadProgress['state'],
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes
          });
        },
        (error) => {
          // Enhance error with user-friendly message
          const enhancedError = new Error(getStorageErrorMessage(error));
          (enhancedError as StorageError).code = error.code;
          reject(enhancedError);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              storagePath,
              downloadUrl,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type
            });
          } catch (error) {
            const enhancedError = new Error('Erro ao gerar link de download. Tente novamente.');
            reject(enhancedError);
          }
        }
      );
    } catch (error) {
      const enhancedError = new Error(getStorageErrorMessage(error));
      reject(enhancedError);
    }
  });
}

/**
 * Uploads a file to Cloudflare R2 using a presigned URL with progress tracking
 */
export async function uploadFileToR2(
  file: File,
  presignedUrl: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      const error = new Error(validation.error);
      (error as StorageError).code = 'file/too-large';
      reject(error);
      return;
    }

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress?.({
          progress,
          state: 'running',
          bytesTransferred: event.loaded,
          totalBytes: event.total
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({
          progress: 100,
          state: 'success',
          bytesTransferred: file.size,
          totalBytes: file.size
        });
        resolve();
      } else {
        reject(new Error(`Upload falhou com status ${xhr.status}. Verifique as configurações de CORS.`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Erro de rede durante o upload para o R2.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelado pelo usuário.'));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Gets the download URL for a storage path
 */
export async function getDocumentDownloadUrl(storagePath: string, storage: FirebaseStorage): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return await getDownloadURL(storageRef);
}

/**
 * Deletes a file from Firebase Storage
 */
export async function deleteFileFromStorage(storagePath: string, storage: FirebaseStorage): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(fileName: string): string {
  return fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
