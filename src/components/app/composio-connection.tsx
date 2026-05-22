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
import { checkComposioConnectionStatus, initiateComposioConnection, clearComposioSessionCache, pollComposioConnectionStatus } from '@/lib/actions/composio-connection-actions';

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
  const [pollingState, setPollingState] = useState<{
    isPolling: boolean;
    progress: number;
    maxAttempts: number;
  }>({ isPolling: false, progress: 0, maxAttempts: 5 });

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!user) {
      setState({ status: 'INACTIVE', loading: false, error: null });
      return;
    }
    checkConnectionStatus();
    return () => { cancelledRef.current = true; };
  }, [user]);

  const prevOpenSignalRef = useRef(openSignal);

  useEffect(() => {
    if (openSignal !== undefined && openSignal > prevOpenSignalRef.current) {
      setDialogOpen(true);
    }
    prevOpenSignalRef.current = openSignal;
  }, [openSignal]);

  async function checkConnectionStatus() {
    if (!user) return;

    // Se estamos no meio de um callback OAuth, deixar o handleCallback
    // gerenciar o estado via polling — evita race condition onde a
    // verificação inicial (antes da conexão estar ativa no Composio)
    // sobrescreve o resultado ACTIVE obtido pelo polling.
    const params = new URLSearchParams(window.location.search);
    if (params.get('composio_connected') === 'true' || params.get('composio_error')) {
      if (!cancelledRef.current) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await checkComposioConnectionStatus(user.uid);
      if (cancelledRef.current) return;
      setState({ status: result.status, loading: false, error: null });
    } catch (error) {
      if (cancelledRef.current) return;
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
      // Persist returnTo in cookie so the callback route can read it after
      // Composio's OAuth redirect (which strips custom query params).
      document.cookie = `composio_return_to=${encodeURIComponent(returnTo)}; path=/; max-age=300; SameSite=Lax`;
      // Redirect to Composio OAuth — navigation will unmount the component,
      // so no need to reset loading state here.
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
    }
  }

  const statusInfo = STATUS_INFO[state.status];
  const debugInfo = getConnectionDebugInfo(state.status, state.error);

  // Check URL params for callback status
  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get('composio_connected');
        const error = params.get('composio_error');

        if (connected === 'true') {
          // Clean URL params first — no page reload needed since we're already on the target page
          toast({
            title: 'Google conectado!',
            description: 'Verificando conexão com Google Docs e Google Drive...',
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
          
          // Use polling to check connection status with retry
          if (user) {
            setPollingState({ isPolling: true, progress: 0, maxAttempts: 5 });

            const result = await pollComposioConnectionStatus(user.uid);

            setPollingState({ isPolling: false, progress: 0, maxAttempts: 5 });
            
            if (result.connected && result.status === 'ACTIVE') {
              toast({
                title: 'Google conectado com sucesso!',
                description: `Conexão verificada em ${result.attempts} tentativa(s). Pronto para gerar contratos.`,
              });
              setState({ status: result.status, loading: false, error: null });
              onConnected?.();
            } else {
              const statusDetail = {
                FAILED: 'O servidor do Google não respondeu a tempo. Tente novamente.',
                EXPIRED: 'Sua conexão anterior expirou. Reconecte sua conta.',
                INACTIVE: 'Nenhuma conexão ativa encontrada. Clique em "Conectar Google" para autorizar.',
                INITIATED: 'Conexão ainda sendo processada. Aguarde alguns segundos e atualize.',
                INITIALIZING: 'Conexão ainda sendo processada. Aguarde alguns segundos e atualize.',
              }[result.status] || 'Não foi possível verificar a conexão.';
              toast({
                variant: 'destructive',
                title: 'Conexão não verificada',
                description: `${statusDetail} Tente clicar em "Atualizar status" ou reconecte.`,
              });
              setState({ status: result.status, loading: false, error: null });
            }
          }
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
    }

    handleCallback();
  }, [user]);

  return (
    <>
      {state.loading || pollingState.isPolling ? (
        <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
          <span className="animate-spin text-sm">⏳</span>
          <span className="text-sm">
            {pollingState.isPolling ? 'Verificando conexão com Google...' : 'Verificando conexão...'}
          </span>
        </div>
      ) : inline ? (
        <div className={`flex items-center gap-2 ${className}`}>
          <span>{statusInfo.icon}</span>
          <div>
            <p className="text-sm font-medium">{statusInfo.label}</p>
            <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
          </div>
        </div>
      ) : showButton ? (
        <Button
          onClick={() => setDialogOpen(true)}
          variant={state.status === 'ACTIVE' ? 'secondary' : 'default'}
          className={className}
        >
          {statusInfo.icon} {state.status === 'ACTIVE' ? 'Verificar conexão' : buttonLabel}
        </Button>
      ) : children ? (
        <div className={className}>{children}</div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusInfo.icon} {statusInfo.label}
            </DialogTitle>
            <DialogDescription>{statusInfo.description}</DialogDescription>
          </DialogHeader>

          {state.loading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground gap-2 text-sm">
              <span className="animate-spin">⏳</span>
              <span>Processando...</span>
            </div>
          )}

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
              <>
                <Button onClick={checkConnectionStatus} variant="outline" disabled={state.loading}>
                  Atualizar status
                </Button>
                <Button onClick={initiateConnection} disabled={state.loading}>
                  {state.loading ? 'Redirecionando...' : 'Reconectar Google'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
