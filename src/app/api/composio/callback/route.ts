/**
 * Composio OAuth Callback Route
 * Handles redirect back from Composio Google OAuth flow
 *
 * GET /api/composio/callback?status=success&user_id=xxx
 * GET /api/composio/callback?status=error&error=access_denied
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const userId = searchParams.get('user_id');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const redirectUrl = new URL('/gerar-exportar', request.url);

  // Handle error cases
  if (status === 'error' || error) {
    const errorType = error || 'UNKNOWN';
    const errorMsg = errorDescription || 'Erro desconhecido na conexão com Google.';

    console.error('[ComposioCallback] OAuth error', { error: errorType, description: errorDescription, userId });

    // Store error in Firestore if userId available
    if (userId) {
      try {
        await db.collection('composio_connections').doc(userId).set(
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

  // Handle success
  if (status === 'success' && userId) {
    console.info('[ComposioCallback] OAuth success', { userId });

    try {
      // Store successful connection in Firestore
      await db.collection('composio_connections').doc(userId).set(
        {
          status: 'ACTIVE',
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      redirectUrl.searchParams.set('composio_connected', 'true');
    } catch (dbError) {
      console.error('[ComposioCallback] Failed to store connection in Firestore', dbError);
      // Still redirect with success — Firestore write failure shouldn't block the flow
      redirectUrl.searchParams.set('composio_connected', 'true');
    }

    return NextResponse.redirect(redirectUrl.toString());
  }

  // Handle missing parameters — redirect to gerar-exportar with error
  console.warn('[ComposioCallback] Missing parameters', { status, userId });
  redirectUrl.searchParams.set('composio_error', 'Parâmetros inválidos no callback.');
  return NextResponse.redirect(redirectUrl.toString());
}
