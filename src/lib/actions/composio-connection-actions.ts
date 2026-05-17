'use server';

import { createComposioClient, clearSessionCache, type ConnectionStatus } from '@/lib/composio-client';
import { debugLog, debugError, generateRequestId } from '@/lib/utils/request-id';

/**
 * Server actions for Composio connection management.
 * These are called from client components to check connection status
 * and initiate the OAuth connection flow.
 */

/**
 * Clear the session cache for a user after OAuth completion.
 * This ensures the next status check creates a fresh session that can see the new connection.
 */
export async function clearComposioSessionCache(
  userId: string
): Promise<void> {
  const requestId = generateRequestId();
  debugLog(requestId, 'clearComposioSessionCache', 'Clearing session cache', { userId });
  clearSessionCache(userId);
}

/**
 * Check Composio connection status for a user.
 * Returns the connection status object directly.
 */
export async function checkComposioConnectionStatus(
  userId: string
): Promise<{ connected: boolean; status: ConnectionStatus }> {
  const requestId = generateRequestId();
  debugLog(requestId, 'checkComposioConnectionStatus', 'Checking connection', { userId });

  // Step 1: Clear cache (best-effort, never throws)
  try {
    clearSessionCache(userId);
  } catch (cacheError) {
    debugError(requestId, 'checkComposioConnectionStatus', 'Cache clear failed', cacheError);
  }

  // Step 2: Create client (can throw if COMPOSIO_API_KEY is missing)
  let client;
  try {
    client = await createComposioClient(userId);
  } catch (clientError) {
    debugError(requestId, 'checkComposioConnectionStatus', 'Client creation failed', clientError, { userId });
    console.error('[Composio] checkComposioConnectionStatus — client creation error:', clientError, { userId });
    return { connected: false, status: 'FAILED' };
  }

  // Step 3: Check connection (can throw on network/API errors)
  try {
    const result = await client.checkConnection(userId);
    debugLog(requestId, 'checkComposioConnectionStatus', 'Connection check result', {
      userId,
      connected: result.connected,
      status: result.status,
    });
    return result;
  } catch (checkError) {
    debugError(requestId, 'checkComposioConnectionStatus', 'Connection check failed', checkError, { userId });
    console.error('[Composio] checkComposioConnectionStatus error:', checkError, { userId });
    return { connected: false, status: 'FAILED' };
  }
}

/**
 * Poll connection status with retry after OAuth completion.
 * Checks status multiple times with delays to allow Composio to process the OAuth connection.
 * 
 * @param userId - The user ID to check
 * @param maxAttempts - Maximum number of attempts (default: 8)
 * @param delayMs - Delay between attempts in milliseconds (default: 2000ms = 2s)
 * @returns The connection status object
 */
export async function pollComposioConnectionStatus(
  userId: string,
  maxAttempts: number = 8,
  delayMs: number = 2000
): Promise<{ connected: boolean; status: ConnectionStatus; attempts: number }> {
  const requestId = generateRequestId();
  debugLog(requestId, 'pollComposioConnectionStatus', 'Starting polling', { userId, maxAttempts, delayMs });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Clear cache before each attempt to ensure fresh session
      clearSessionCache(userId);
      
      const client = await createComposioClient(userId);
      const result = await client.checkConnection(userId);
      
      debugLog(requestId, 'pollComposioConnectionStatus', `Attempt ${attempt}/${maxAttempts}`, {
        userId,
        connected: result.connected,
        status: result.status,
      });

      // If connected, return immediately
      if (result.connected && result.status === 'ACTIVE') {
        debugLog(requestId, 'pollComposioConnectionStatus', 'Connection active, polling complete', {
          userId,
          attempts: attempt,
        });
        return { ...result, attempts: attempt };
      }

      // If not last attempt, wait before retrying
      if (attempt < maxAttempts) {
        debugLog(requestId, 'pollComposioConnectionStatus', `Waiting ${delayMs}ms before next attempt`, {
          userId,
          attempt,
          status: result.status,
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      debugError(requestId, 'pollComposioConnectionStatus', `Attempt ${attempt} failed`, error, { userId });
      
      // If not last attempt, wait before retrying
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        debugLog(requestId, 'pollComposioConnectionStatus', 'All attempts failed', { userId, maxAttempts });
      }
    }
  }

  // All attempts exhausted, return last known status
  debugLog(requestId, 'pollComposioConnectionStatus', 'Polling complete, connection not active', {
    userId,
    maxAttempts,
  });

  return { connected: false, status: 'INACTIVE', attempts: maxAttempts };
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

  // Step 1: Create client
  let client;
  try {
    client = await createComposioClient(userId);
  } catch (clientError) {
    debugError(requestId, 'initiateComposioConnection', 'Client creation failed', clientError, { userId });
    console.error('[Composio] initiateComposioConnection — client creation error:', clientError, { userId });
    const errorMsg = clientError instanceof Error ? clientError.message : 'Falha ao iniciar conexão com Google. Tente novamente.';
    return { error: errorMsg };
  }

  // Step 2: Initiate OAuth
  try {
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
