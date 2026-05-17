import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSessionToolkits, mockSessionAuthorize, mockSessionTools, mockComposioCreate, mockComposioUse, mockToolsExecute } = vi.hoisted(() => ({
  mockSessionToolkits: vi.fn(),
  mockSessionAuthorize: vi.fn(),
  mockSessionTools: vi.fn(),
  mockToolsExecute: vi.fn(),
  mockComposioUse: vi.fn(),
  mockComposioCreate: vi.fn(),
}));

vi.mock('@composio/core', () => ({
  Composio: vi.fn(function () {
    const mockSession = {
      toolkits: mockSessionToolkits,
      authorize: mockSessionAuthorize,
      tools: mockSessionTools,
      sessionId: 'test-session-id',
    };
    mockComposioCreate.mockResolvedValue(mockSession);
    mockComposioUse.mockResolvedValue(mockSession);
    return {
      create: mockComposioCreate,
      use: mockComposioUse,
      tools: {
        execute: mockToolsExecute,
      },
    };
  }),
}));

vi.mock('@composio/google', () => ({
  GoogleProvider: vi.fn(),
}));

vi.mock('../composio-tools-mapping', () => ({
  COMPOSIO_GOOGLE_TOOLS: {
    DOCS_GET_DOCUMENT: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT',
    DOCS_UPDATE_DOCUMENT: 'GOOGLEDOCS_UPDATE_DOCUMENT_BATCH',
    DRIVE_GET_FILE: 'GOOGLEDRIVE_GET_FILE_V2',
    DRIVE_COPY_FILE: 'GOOGLEDRIVE_COPY_FILE_ADVANCED',
    DRIVE_CREATE_PERMISSION: 'GOOGLEDRIVE_CREATE_PERMISSION',
  },
  mapComposioError: vi.fn((e: unknown) => e),
  mapComposioDriveError: vi.fn((e: unknown) => e),
}));

// Mock executeWithRetryAndAuthRefresh as a pass-through
vi.mock('../composio-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../composio-client')>();
  return {
    ...original,
    executeWithRetryAndAuthRefresh: vi.fn().mockImplementation((fn: any) => fn()),
  };
});

import { createComposioClient, __clearAllSessionCachesForTesting } from '../composio-client';

describe('composio-client (v3 session-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearAllSessionCachesForTesting();
  });

  describe('session creation', () => {
    it('creates a session via composio.create(userId)', async () => {
      mockSessionToolkits.mockResolvedValue([
        { slug: 'google', name: 'Google', status: 'ACTIVE' },
      ]);

      const client = await createComposioClient('user-1');
      await client.checkConnection('user-1');

      expect(mockComposioCreate).toHaveBeenCalledWith('user-1');
    });

    it('reuses session via composio.use(sessionId) for same user', async () => {
      mockSessionToolkits.mockResolvedValue([
        { slug: 'google', name: 'Google', status: 'ACTIVE' },
      ]);

      const client1 = await createComposioClient('user-1');
      await client1.checkConnection('user-1');

      // Second client for same user should use cached session via composio.use()
      const client2 = await createComposioClient('user-1');
      await client2.checkConnection('user-1');

      // First call is create(), second call should be use()
      expect(mockComposioCreate).toHaveBeenCalledTimes(1);
      expect(mockComposioUse).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection status via session.toolkits()', () => {
    it('returns ACTIVE when Google toolkit is active', async () => {
      mockSessionToolkits.mockResolvedValue([
        { slug: 'google', name: 'Google', status: 'ACTIVE' },
      ]);

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(true);
      expect(result.status).toBe('ACTIVE');
    });

    it('returns INACTIVE when no Google toolkit found', async () => {
      mockSessionToolkits.mockResolvedValue([]);

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('INACTIVE');
    });

    it('returns FAILED when toolkits() throws', async () => {
      mockSessionToolkits.mockRejectedValue(new Error('Network error'));

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('initiateConnection via session.authorize()', () => {
    it('calls session.authorize("google") for OAuth', async () => {
      mockSessionAuthorize.mockResolvedValue({
        redirectUrl: 'https://connect.composio.dev/link/test',
      });

      const client = await createComposioClient('user-1');
      const result = await client.initiateConnection('user-1');

      expect(mockSessionAuthorize).toHaveBeenCalledWith('google', expect.objectContaining({
        callbackUrl: expect.stringContaining('/api/composio/callback'),
      }));
      expect(result).toBe('https://connect.composio.dev/link/test');
    });

    it('passes authConfigId when provided for custom auth', async () => {
      mockSessionAuthorize.mockResolvedValue({
        redirectUrl: 'https://connect.composio.dev/link/custom',
      });

      const client = await createComposioClient('user-1', {
        googleAuthConfigId: 'ac_custom_config',
      });
      await client.initiateConnection('user-1');

      expect(mockSessionAuthorize).toHaveBeenCalledWith('google', expect.objectContaining({
        authConfigId: 'ac_custom_config',
      }));
    });
  });

  describe('clearConnectedAccountIdCache', () => {
    it('clears session cache forcing new session on next request', async () => {
      mockSessionToolkits.mockResolvedValue([
        { slug: 'google', name: 'Google', status: 'ACTIVE' },
      ]);

      const client = await createComposioClient('user-1');
      await client.checkConnection('user-1');

      // Clear cache
      client.clearConnectedAccountIdCache('user-1');

      // Next request should create a new session (not use cached)
      const client2 = await createComposioClient('user-1');
      await client2.checkConnection('user-1');

      // Both should have called create() since cache was cleared
      expect(mockComposioCreate).toHaveBeenCalledTimes(2);
    });
  });
});
