'use server';

/**
 * Server actions for Composio connection management.
 * These are called from client components to check connection status
 * and initiate the OAuth connection flow.
 */

import { createComposioClient, type ConnectionStatus } from '@/lib/composio-client';

/**
 * Check Composio connection status for a user.
 * Returns the connection status object directly.
 */
export async function checkComposioConnectionStatus(
  userId: string
): Promise<{ connected: boolean; status: ConnectionStatus }> {
  try {
    const client = await createComposioClient(userId);
    return await client.checkConnection(userId);
  } catch {
    return { connected: false, status: 'FAILED' };
  }
}

/**
 * Initiate Composio OAuth connection for a user.
 * Returns the redirect URL to Composio's OAuth flow.
 */
export async function initiateComposioConnection(
  userId: string
): Promise<{ redirectUrl: string }> {
  const client = await createComposioClient(userId);
  const redirectUrl = await client.initiateConnection(userId);
  return { redirectUrl };
}
