'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@/firebase/provider';
import { useProjectDocuments } from '@/hooks/use-projects';
import {
  uploadFileToR2,
  generateStoragePath,
  validateFile,
  UploadProgress,
  formatFileSize,
  withRetry
} from '@/lib/storage';
import { DocumentStatus, ProjectDocument } from '@/lib/types';
import { getUploadUrl } from '@/lib/actions/storage-actions';
import { getValidMimeType } from '@/lib/mime-type-utils';

export interface FileUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  documentId: string | null;
}

export interface UseFileUploadReturn {
  uploadState: FileUploadState;
  uploadFile: (
    file: File,
    projectId: string,
    documentType: string,
    documentName: string
  ) => Promise<string | null>;
  resetUpload: () => void;
}

export function useFileUpload(projectId: string | null): UseFileUploadReturn {
  const { user } = useUser();
  const { addDocument, documents } = useProjectDocuments(projectId);
  
  const [uploadState, setUploadState] = useState<FileUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    documentId: null
  });

  const resetUpload = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      documentId: null
    });
  }, []);

  const uploadFile = useCallback(
    async (
      file: File,
      projectId: string,
      documentType: string,
      documentName: string
    ): Promise<string | null> => {
      if (!user) {
        setUploadState(prev => ({
          ...prev,
          error: 'Usuário não autenticado'
        }));
        return null;
      }

      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadState(prev => ({
          ...prev,
          error: validation.error || 'Arquivo inválido'
        }));
        return null;
      }

      setUploadState({
        isUploading: true,
        progress: 0,
        error: null,
        documentId: null
      });

      try {
        // Calculate next version number for this document type
        const existingDocs = documents?.filter(
          doc => doc.documentType === documentType
        ) || [];
        const nextVersion = existingDocs.length + 1;

        // 1. Get signed URL from server for R2 upload (with retry)
        const uploadUrlResult = await withRetry(
          () => getUploadUrl(projectId, user.uid, file.name, file.type),
          2,  // max retries
          1000 // base delay 1s
        );

        if (!uploadUrlResult.success || !uploadUrlResult.url) {
          throw new Error(uploadUrlResult.error || 'Falha ao obter URL de upload do servidor');
        }

        // 2. Upload to Cloudflare R2 (with retry)
        await withRetry(
          () => uploadFileToR2(
            file,
            uploadUrlResult.url!,
            (progress: UploadProgress) => {
              setUploadState(prev => ({
                ...prev,
                progress: progress.progress
              }));
            }
          ),
          2,  // max retries
          1500 // base delay 1.5s
        );

        // 3. Create document metadata in Firestore
        const docData: Omit<ProjectDocument, 'id'> = {
          projectId,
          name: documentName,
          fileUrl: '', // For R2, we generate signed URLs on demand
          fileType: file.name.split('.').pop() || '',
          fileSize: file.size,
          uploadedBy: user.uid,
          uploadedAt: new Date().toISOString(),
          status: DocumentStatus.UPLOADED,
          mimeType: getValidMimeType(file.name, file.type),
          storagePath: uploadUrlResult.key,
          storageProvider: 'r2',
          // Add custom fields for versioning
          version: nextVersion,
          originalFileName: file.name,
          documentType: documentType
        };

        const documentId = await addDocument(docData);

        setUploadState({
          isUploading: false,
          progress: 100,
          error: null,
          documentId
        });

        return documentId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload do arquivo';
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: errorMessage
        }));
        return null;
      }
    },
    [user, addDocument, documents]
  );

  return {
    uploadState,
    uploadFile,
    resetUpload
  };
}

/**
 * Hook to get documents grouped by type with versions
 */
export function useDocumentsByType(projectId: string | null) {
  const { documents, isLoading, error } = useProjectDocuments(projectId);

  const documentsByType = documents?.reduce((acc, doc) => {
    const type = doc.documentType === 'extraDocument'
      ? 'extraDocument1'
      : (doc.documentType || 'other');
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, (ProjectDocument & { id: string })[]>);

  Object.values(documentsByType || {}).forEach((group) => {
    group.sort((a, b) => {
      const uploadedAtDiff = new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
      if (uploadedAtDiff !== 0) {
        return uploadedAtDiff;
      }
      return (b.version || 0) - (a.version || 0);
    });
  });

  return {
    documentsByType,
    isLoading,
    error
  };
}
