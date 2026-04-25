'use server';

/**
 * Shared types for Composio integration.
 * This file has NO 'use server' directive - types can be imported freely.
 */

export type ConnectionStatus = 'ACTIVE' | 'INITIATED' | 'EXPIRED' | 'FAILED' | 'INACTIVE';
