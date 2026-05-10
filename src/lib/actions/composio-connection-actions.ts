'use server';

import { createComposioClient, type ConnectionStatus } from '@/lib/composio-client';
import { debugLog, debugError, generateRequestId } from '@/lib/utils/request-id';

/**
 * Server actions for Composio connection management.
 * These are called from client components to check connection status
 * and initiate the OAuth connection flow.
 */

/**
 * Check Composio connection status for a user.
 * Returns the connection status object directly.
 */
export async function checkComposioConnectionStatus(
  userId: string
): Promise<{ connected: boolean; status: ConnectionStatus }> {
  const requestId = generateRequestId();
  debugLog(requestId, 'checkComposioConnectionStatus', 'Checking connection', { userId });

  try {
    const client = await createComposioClient(userId);
    const result = await client.checkConnection(userId);
    debugLog(requestId, 'checkComposioConnectionStatus', 'Connection check result', {
      userId,
      connected: result.connected,
      status: result.status,
    });
    return result;
  } catch (error) {
    debugError(requestId, 'checkComposioConnectionStatus', 'Connection check failed', error, { userId });
    console.error('[Composio] checkComposioConnectionStatus error:', error, { userId });
    return { connected: false, status: 'FAILED' };
  }
}

/**
 * Initiate Composio OAuth connection for a user.
 * Returns the redirect URL or an error message.
 */
export async function initiateComposioConnection(
  userId: string,
  returnTo?: string
): Promise<{ redirectUrl: string } | { error: string }> {
  const requestId = generateRequestId();
  debugLog(requestId, 'initiateComposioConnection', 'Initiating connection', { userId, returnTo });

  try {
    const client = await createComposioClient(userId);
    const redirectUrl = await client.initiateConnection(userId, returnTo);
    debugLog(requestId, 'initiateComposioConnection', 'Connection initiated', { redirectUrl });
    return { redirectUrl };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Falha ao iniciar conexão com Google. Tente novamente.';
    debugError(requestId, 'initiateComposioConnection', 'Connection initiation failed', error, { userId, returnTo });
    console.error('[Composio] initiateComposioConnection error:', error, { userId });
    return { error: errorMsg };
  }
}
