'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useUser } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ConnectionStatus } from '@/lib/composio-types';
import { checkComposioConnectionStatus, initiateComposioConnection } from '@/lib/actions/composio-connection-actions';
import { generateRequestId } from '@/lib/utils/request-id';

interface ComposioConnectionState {
  status: ConnectionStatus;
  loading: boolean;
  error: string | null;
}

interface ComposioConnectionProps {
  onConnected?: () => void;
  onError?: (error: string) => void;
  children?: ReactNode;
  /** If true, shows a button that opens the connection dialog */
  showButton?: boolean;
  /** Button label */
  buttonLabel?: string;
  /** If true, shows inline status instead of button */
  inline?: boolean;
  /** Increment this value to open the connection dialog from a parent flow */
  openSignal?: number;
  className?: string;
}

type ConnectionStatusInfo = {
  label: string;
  description: string;
  variant: 'success' | 'warning' | 'error' | 'default' | 'secondary';
  icon: string;
};

const STATUS_INFO: Record<ConnectionStatus, ConnectionStatusInfo> = {
  ACTIVE: {
    label: 'Google conectado',
    description: 'Sua conta Google está conectada e pronta para geração de contratos.',
    variant: 'success',
    icon: '✅',
  },
  INITIATED: {
    label: 'Conexão em andamento',
    description: 'Aguarde enquanto redirecionamos você para confirmar o acesso.',
    variant: 'warning',
    icon: '🔄',
  },
  INITIALIZING: {
    label: 'Processando conexão',
    description: 'Sua conexão Google está sendo ativada. Isso leva alguns segundos.',
    variant: 'warning',
    icon: '⏳',
  },
  EXPIRED: {
    label: 'Conexão expirada',
    description: 'Sua conexão com Google expirou. Conecte-se novamente.',
    variant: 'warning',
    icon: '⚠️',
  },
  FAILED: {
    label: 'Erro na conexão',
    description: 'Não foi possível conectar sua conta Google. Tente novamente.',
    variant: 'error',
    icon: '❌',
  },
  INACTIVE: {
    label: 'Google não conectado',
    description: 'Conecte sua conta Google para gerar contratos a partir de templates.',
    variant: 'default',
    icon: '🔗',
  },
};

// Expose connection details for debugging
export function getConnectionDebugInfo(status: ConnectionStatus, error: string | null) {
  return {
    status,
    error,
    timestamp: new Date().toISOString(),
    hints: {
      FAILED: 'Verifique COMPOSIO_API_KEY e COMPOSIO_GOOGLE_AUTH_CONFIG_ID nas variáveis de ambiente',
      EXPIRED: 'A sessão OAuth expirou. Tente reconectar.',
      INACTIVE: 'Nenhuma conta Google está conectada. Use o botão para iniciar o fluxo OAuth.',
      INITIATED: 'Aguarde o redirecionamento OAuth completar.',
    },
  };
}

export function ComposioConnection({
  onConnected,
  onError,
  children,
  showButton = true,
  buttonLabel = 'Conectar Google',
  inline = false,
  openSignal = 0,
  className = '',
}: ComposioConnectionProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [state, setState] = useState<ComposioConnectionState>({
    status: 'INACTIVE',
    loading: true,
    error: null,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setState({ status: 'INACTIVE', loading: false, error: null });
      return;
    }
    checkConnectionStatus().then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [user]);

  const lastOpenSignal = useRef(openSignal ?? 0);

  useEffect(() => {
    if (openSignal !== undefined && openSignal > lastOpenSignal.current) {
      lastOpenSignal.current = openSignal;
      setDialogOpen(true);
    }
  }, [openSignal]);

  async function checkConnectionStatus() {
    if (!user) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await checkComposioConnectionStatus(user.uid);
      setState({ status: result.status, loading: false, error: null });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro ao verificar conexão';
      console.error(`[ComposioConnection] Error checking connection for user ${user.uid}:`, error);
      setState({ status: 'FAILED', loading: false, error: errorMsg });
      onError?.(errorMsg);
    }
  }

  async function initiateConnection() {
    if (!user) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      let returnTo: string;
      try {
        returnTo = window.location.pathname + window.location.search;
      } catch {
        returnTo = '/';
      }
      const result = await initiateComposioConnection(user.uid, returnTo);

      if ('error' in result && result.error) {
        setState({ status: 'FAILED', loading: false, error: result.error });
        console.error(`[ComposioConnection] initiateConnection error:`, result.error);
        toast({
          variant: 'destructive',
          title: 'Erro ao conectar',
          description: result.error,
        });
        onError?.(result.error);
        return;
      }

      if (!('redirectUrl' in result)) {
        throw new Error('Composio não retornou a URL de conexão.');
      }

      // Store current path to return to after OAuth
      sessionStorage.setItem('composio_return_to', returnTo);
      // Redirect to Composio OAuth
      window.location.href = result.redirectUrl;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro ao iniciar conexão';
      console.error(`[ComposioConnection] initiateConnection exception:`, error);
      setState({ status: 'FAILED', loading: false, error: errorMsg });
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar',
        description: errorMsg,
      });
      onError?.(errorMsg);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }

  const statusInfo = STATUS_INFO[state.status];
  const debugInfo = getConnectionDebugInfo(state.status, state.error);

  // Check URL params for callback status
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get('composio_connected');
      const error = params.get('composio_error');

      if (connected === 'true') {
        // Clean URL params first — no page reload needed since we're already on the target page
        toast({
          title: 'Google conectado!',
          description: 'Sua conta Google foi conectada com sucesso.',
        });
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('composio_connected');
          url.searchParams.delete('return_to');
          window.history.replaceState({}, '', url.toString());
        } catch {
          // URL parsing failed, but connection was successful
        }
        sessionStorage.removeItem('composio_return_to');
        // Re-check connection status now that OAuth has completed
        checkConnectionStatus();
        onConnected?.();
      } else if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro na conexão',
          description: error,
        });
        setState({ status: 'FAILED', loading: false, error });
        onError?.(error);
        // Clean URL
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('composio_error');
          url.searchParams.delete('return_to');
          window.history.replaceState({}, '', url.toString());
        } catch {
          // URL parsing failed, but cleanup is best-effort
        }
      }
    } catch {
      console.error('[ComposioConnection] Error parsing URL params');
    }
  }, []);

  if (state.loading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <span className="animate-spin text-sm">⏳</span>
        <span className="text-sm">Verificando conexão...</span>
      </div>
    );
  }

  if (inline) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span>{statusInfo.icon}</span>
        <div>
          <p className="text-sm font-medium">{statusInfo.label}</p>
          <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
        </div>
      </div>
    );
  }

  if (showButton) {
    return (
      <>
        <Button
          onClick={() => setDialogOpen(true)}
          variant={state.status === 'ACTIVE' ? 'secondary' : 'default'}
          className={className}
        >
          {statusInfo.icon} {state.status === 'ACTIVE' ? 'Verificar conexão' : buttonLabel}
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {statusInfo.icon} {statusInfo.label}
              </DialogTitle>
              <DialogDescription>{statusInfo.description}</DialogDescription>
            </DialogHeader>

            {state.error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                {state.error}
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              {state.status !== 'ACTIVE' && (
                <Button onClick={initiateConnection} disabled={state.loading}>
                  {state.loading ? 'Redirecionando...' : 'Conectar Google'}
                </Button>
              )}
              {state.status === 'ACTIVE' && (
                <Button onClick={checkConnectionStatus} variant="secondary">
                  Atualizar status
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return children ? (
    <div className={className}>{children}</div>
  ) : null;
}

/**
 * Hook to check Composio connection status
 */
export function useComposioConnection() {
  const { user } = useUser();
  const [status, setStatus] = useState<ConnectionStatus>('INACTIVE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStatus('INACTIVE');
      setLoading(false);
      return;
    }

    async function check() {
      if (!user) return;
      try {
        const result = await checkComposioConnectionStatus(user.uid);
        setStatus(result.status);
      } catch {
        setStatus('FAILED');
      } finally {
        setLoading(false);
      }
    }

    check();
  }, [user]);

  return { status, loading, isConnected: status === 'ACTIVE' };
}
