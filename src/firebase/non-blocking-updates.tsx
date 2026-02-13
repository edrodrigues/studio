
'use client';

import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Helper to emit appropriate error type based on error code
 */
function emitFirestoreError(error: any, path: string, operation: string, requestData?: any) {
  if (error.code === 'permission-denied') {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path,
        operation: operation as any,
        requestResourceData: requestData,
      })
    );
  } else {
    errorEmitter.emit('firestore-error', {
      path,
      operation,
      code: error.code,
      message: error.message,
      originalError: error,
    });
  }
}

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  const operation = (options && 'merge' in options && options.merge) ? 'update' : 'create';
  setDoc(docRef, data, options).catch(error => {
    emitFirestoreError(error, docRef.path, operation, data);
  });
}

/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data).catch(error => {
    emitFirestoreError(error, colRef.path, 'create', data);
  });
  return promise;
}

/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data).catch(error => {
    emitFirestoreError(error, docRef.path, 'update', data);
  });
}

/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef).catch(error => {
    emitFirestoreError(error, docRef.path, 'delete');
  });
}
