/**
 * Shared types for Composio integration.
 * Types can be imported freely in both client and server components.
 */

export type ConnectionStatus = 'ACTIVE' | 'INITIATED' | 'INITIALIZING' | 'EXPIRED' | 'FAILED' | 'INACTIVE';

/**
 * Represents a Composio session (v3 pattern).
 * Created via composio.create(userId), reused via composio.use(sessionId).
 */
export interface ComposioSession {
  sessionId: string;
  tools(): Promise<unknown[]>;
  toolkits(): Promise<ComposioToolkit[]>;
  authorize(toolkitSlug: string, options?: AuthorizeOptions): Promise<AuthorizeResult>;
}

/**
 * A toolkit available in a Composio session.
 * Returned by session.toolkits().
 */
export interface ComposioToolkit {
  slug: string;
  name: string;
  status: string;
  connectedAccountIds?: string[];
}

/**
 * Options for session.authorize() — generates a Connect Link for OAuth.
 */
export interface AuthorizeOptions {
  callbackUrl?: string;
  authConfigId?: string;
}

/**
 * Result of session.authorize() — contains the OAuth redirect URL.
 */
export interface AuthorizeResult {
  redirectUrl: string;
  connectionId?: string;
}
