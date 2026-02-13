'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for globally emitted error events.
 * Displays toast notifications for errors instead of throwing and crashing the app.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error('Firebase permission error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de Permissão',
        description: `Você não tem permissão para ${error.operation} em ${error.path}`,
      });
    };

    const handleFirestoreError = (error: any) => {
      console.error('Firestore error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de Conexão',
        description: error.message || 'Erro ao acessar o banco de dados. Tente novamente.',
      });
    };

    const handleAuthError = (error: any) => {
      console.error('Auth error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de Autenticação',
        description: error.message || 'Erro ao fazer login. Verifique suas credenciais.',
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    errorEmitter.on('firestore-error', handleFirestoreError);
    errorEmitter.on('auth-error', handleAuthError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
      errorEmitter.off('firestore-error', handleFirestoreError);
      errorEmitter.off('auth-error', handleAuthError);
    };
  }, [toast]);

  // This component renders nothing.
  return null;
}
