/**
 * Composio OAuth Callback Route
 * Handles redirect back from Composio Google OAuth flow
 *
 * Composio redirects here with different query params depending on the outcome:
 * Success: /api/composio/callback?status=success&connectedAccountId=xxx&appName=xxx
 * Error:   /api/composio/callback?status=error&error=xxx&error_description=xxx
 *
 * The callbackUrl we pass to composio.connectedAccounts.initiate() is the
 * final destination AFTER Composio processes the OAuth callback internally.
 * This route simply stores the result and redirects the user back to the app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const connectedAccountId = searchParams.get('connectedAccountId');
  const appName = searchParams.get('appName');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const userId = searchParams.get('user_id');

  // Build redirect URL — prefer sessionStorage return path (handled client-side)
  const redirectUrl = new URL('/gerar-exportar', request.url);

  // Handle error cases
  if (status === 'error' || error) {
    const errorType = error || 'UNKNOWN';
    const errorMsg = errorDescription || 'Erro desconhecido na conexão com Google.';

    console.error('[ComposioCallback] OAuth error', { error: errorType, description: errorDescription, connectedAccountId, userId });

    // Store error in Firestore if connectedAccountId available
    if (connectedAccountId) {
      try {
        await db.collection('composio_connections').doc(connectedAccountId).set(
          {
            status: 'FAILED',
            error: errorType,
            errorMessage: errorMsg,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbError) {
        console.error('[ComposioCallback] Failed to store error in Firestore', dbError);
      }
    }

    redirectUrl.searchParams.set('composio_error', errorMsg);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Handle success — Composio sends status=success with connectedAccountId
  if (status === 'success' || connectedAccountId) {
    console.info('[ComposioCallback] OAuth success', { connectedAccountId, appName, userId });

    // Store successful connection
    const docId = userId || connectedAccountId;
    if (docId) {
      try {
        await db.collection('composio_connections').doc(docId).set(
          {
            status: 'ACTIVE',
            connectedAccountId: connectedAccountId || '',
            appName: appName || '',
            connectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbError) {
        console.error('[ComposioCallback] Failed to store connection in Firestore', dbError);
        // Still redirect with success — Firestore write failure shouldn't block the flow
      }
    }

    redirectUrl.searchParams.set('composio_connected', 'true');
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Handle missing parameters — redirect with error
  console.warn('[ComposioCallback] Missing parameters', { status, connectedAccountId, userId });
  redirectUrl.searchParams.set('composio_error', 'Parâmetros inválidos no callback.');
  return NextResponse.redirect(redirectUrl.toString());
}
