/**
 * Composio OAuth Callback Route
 * Handles redirect back from Composio Google OAuth flow
 *
 * Composio redirects here with different query params depending on the outcome:
 * Success: /api/composio/callback?status=success&connectedAccountId=xxx&appName=xxx
 * Error:   /api/composio/callback?status=error&error=xxx&error_description=xxx
 *
 * The callbackUrl we pass to session.authorize("google") is the
 * final destination AFTER Composio processes the OAuth callback internally.
 * This route simply stores the result and redirects the user back to the app.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const connectedAccountId = searchParams.get('connectedAccountId');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const returnTo = searchParams.get('return_to');

  // Validate returnTo against a whitelist of allowed paths to prevent open redirect
  const ALLOWED_RETURN_PATHS = [
    '/gerar-exportar',
    '/dashboard',
    '/templates',
    '/contratos',
    '/configuracoes',
  ] as const;

  const isValidReturnPath = (path: string): boolean => {
    // Must start with / but not // (protocol-relative)
    if (!path.startsWith('/') || path.startsWith('//')) return false;
    // Must not contain path traversal segments
    if (path.includes('..')) return false;
    // Must match a known allowed path or be a subpath of one
    return ALLOWED_RETURN_PATHS.some(
      (allowed) => path === allowed || path.startsWith(allowed + '/')
    );
  };

  const safeReturnTo = returnTo && isValidReturnPath(returnTo)
    ? returnTo
    : '/gerar-exportar';
  const redirectUrl = new URL(safeReturnTo, request.url);

  // Handle error cases
  if (status === 'error' || error) {
    const errorType = error || 'UNKNOWN';
    const errorMsg = errorDescription || 'Erro desconhecido na conexão com Google.';
    console.error('[ComposioCallback] OAuth error', { error: errorType, description: errorDescription, connectedAccountId });
    redirectUrl.searchParams.set('composio_error', errorMsg);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Handle success
  if (status === 'success' || connectedAccountId) {
    console.info('[ComposioCallback] OAuth success', { connectedAccountId });
    // Connection status is verified on-demand via session.toolkits()
    redirectUrl.searchParams.set('composio_connected', 'true');
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Handle missing parameters
  console.warn('[ComposioCallback] Missing parameters', { status, connectedAccountId });
  redirectUrl.searchParams.set('composio_error', 'Parâmetros inválidos no callback.');
  return NextResponse.redirect(redirectUrl.toString());
}
