'use client';

import { useState, useCallback } from 'react';
import { useStorage, useUser } from '@/firebase/provider';
import { useProjectDocuments } from '@/hooks/use-projects';
import {
  uploadFileToStorage,
  generateStoragePath,
  validateFile,
  UploadProgress,
  UploadResult,
  formatFileSize
} from '@/lib/storage';
import { DocumentStatus, ProjectDocument } from '@/lib/types';

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
  const storage = useStorage();
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

        // Generate storage path
        const storagePath = generateStoragePath(
          projectId,
          documentType,
          file.name,
          nextVersion
        );

        // Upload file to Firebase Storage
        const uploadResult = await uploadFileToStorage(
          file,
          storagePath,
          storage,
          (progress: UploadProgress) => {
            setUploadState(prev => ({
              ...prev,
              progress: progress.progress
            }));
          }
        );

        // Create document metadata in Firestore
        const docData: Omit<ProjectDocument, 'id'> = {
          projectId,
          name: documentName,
          fileUrl: uploadResult.downloadUrl,
          fileType: uploadResult.fileName.split('.').pop() || '',
          fileSize: uploadResult.fileSize,
          uploadedBy: user.uid,
          uploadedAt: new Date().toISOString(),
          status: DocumentStatus.UPLOADED,
          mimeType: uploadResult.mimeType,
          storagePath: uploadResult.storagePath,
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
    [storage, user, addDocument, documents]
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
    const type = doc.documentType || 'other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, (ProjectDocument & { id: string })[]>);

  return {
    documentsByType,
    isLoading,
    error
  };
}
