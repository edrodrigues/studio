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
      const operation = error.request?.method || 'unknown';
      const path = error.request?.path || 'unknown';
      
      console.group('🔒 Permission Denied');
      console.error('Operation:', operation);
      console.error('Path:', path);
      console.error('Request:', error.request);
      console.error('Full error:', error);
      console.groupEnd();
      
      // Also show an alert for visibility during debugging
      if (typeof window !== 'undefined') {
        console.log('%c PERMISSION ERROR: Check the console group above for details ', 'background: #ff0000; color: #ffffff; font-size: 16px; padding: 10px;');
      }
      
      toast({
        variant: 'destructive',
        title: 'Erro de Permissão',
        description: `Você não tem permissão para ${operation} em ${path}`,
      });
    };

    const handleFirestoreError = (error: any) => {
      // FirestoreError objects have getters that don't serialize properly
      // Extract properties manually using Object.getOwnPropertyNames
      const extractProps = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        const props: any = {};
        for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
          try {
            const val = (obj as any)[key];
            if (typeof val !== 'function' && val !== undefined) {
              props[key] = val;
            }
          } catch (e) { /* ignore */ }
        }
        // Also try direct property access
        ['message', 'code', 'name', 'stack'].forEach(key => {
          try {
            if ((obj as any)[key] !== undefined && props[key] === undefined) {
              props[key] = (obj as any)[key];
            }
          } catch (e) { /* ignore */ }
        });
        return props;
      };
      
      const errorProps = extractProps(error);
      const originalErrorProps = extractProps(error?.originalError);
      
      const errorDetails = {
        message: errorProps?.message || originalErrorProps?.message || String(error?.message) || 'Erro desconhecido',
        code: errorProps?.code || originalErrorProps?.code || String(error?.code) || 'unknown',
        path: error?.path || 'unknown',
        operation: error?.operation || 'unknown',
      };
      
      console.group('🔥 Firestore Error');
      console.error('Error details:', errorDetails);
      console.error('Error object properties:', errorProps);
      console.error('Original error properties:', originalErrorProps);
      console.error('Raw error:', error);
      console.error('Original error:', error?.originalError);
      console.groupEnd();
      
      toast({
        variant: 'destructive',
        title: 'Erro de Conexão',
        description: errorDetails.message || 'Erro ao acessar o banco de dados. Tente novamente.',
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
