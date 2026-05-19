import { beforeEach, describe, expect, it, vi, beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  vi.stubEnv('COMPOSIO_API_KEY', 'test-api-key');
  vi.stubEnv('COMPOSIO_GOOGLE_AUTH_CONFIG_ID', 'test-auth-config-id');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const { mockSessionAuthorize, mockSessionTools, mockToolsExecute, mockComposioCreate, mockComposioUse, mockConnectedAccountsList } = vi.hoisted(() => ({
  mockSessionAuthorize: vi.fn(),
  mockSessionTools: vi.fn(),
  mockToolsExecute: vi.fn(),
  mockComposioUse: vi.fn(),
  mockComposioCreate: vi.fn(),
  mockConnectedAccountsList: vi.fn(),
}));

vi.mock('@composio/core', () => ({
  Composio: vi.fn(function () {
    const mockSession = {
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
      connectedAccounts: {
        list: mockConnectedAccountsList,
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

const EXPECTED_CREATE_CONFIG = expect.objectContaining({
  toolkits: ['googledocs', 'googledrive'],
  tools: expect.any(Object),
  authConfigs: expect.any(Object),
  manageConnections: { waitForConnections: true },
});

describe('composio-client (v3 session-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearAllSessionCachesForTesting();
  });

  describe('session creation', () => {
    it('creates a session via composio.create(userId) with full config', async () => {
      mockSessionAuthorize.mockResolvedValue({ redirectUrl: 'https://connect.composio.dev/link/test' });
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-1');
      await client.initiateConnection('user-1');

      expect(mockComposioCreate).toHaveBeenCalledWith('user-1', EXPECTED_CREATE_CONFIG);
    });

    it('passes authConfigId in authConfigs for both toolkits', async () => {
      mockSessionAuthorize.mockResolvedValue({ redirectUrl: 'https://connect.composio.dev/link/test' });
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-1', { googleAuthConfigId: 'ac_custom' });
      await client.initiateConnection('user-1');

      const callArgs = mockComposioCreate.mock.calls[0][1];
      expect(callArgs.authConfigs).toEqual({
        googledocs: 'ac_custom',
        googledrive: 'ac_custom',
      });
    });

    it('reuses session via composio.use(sessionId) for same user', async () => {
      mockSessionAuthorize.mockResolvedValue({ redirectUrl: 'https://connect.composio.dev/link/test' });
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client1 = await createComposioClient('user-1');
      await client1.initiateConnection('user-1');

      const client2 = await createComposioClient('user-1');
      await client2.initiateConnection('user-1');

      expect(mockComposioCreate).toHaveBeenCalledTimes(1);
      expect(mockComposioUse).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection status via connectedAccounts.list()', () => {
    it('returns ACTIVE when both googledocs and googledrive are active', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          { id: 'conn-1', toolkit: { slug: 'googledocs' }, status: 'ACTIVE' },
          { id: 'conn-2', toolkit: { slug: 'googledrive' }, status: 'ACTIVE' },
        ],
      });

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(true);
      expect(result.status).toBe('ACTIVE');
    });

    it('returns INITIATED when googledocs is missing', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          { id: 'conn-1', toolkit: { slug: 'googledrive' }, status: 'ACTIVE' },
        ],
      });

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('INITIATED');
    });

    it('returns INITIATED when googledrive is missing', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          { id: 'conn-1', toolkit: { slug: 'googledocs' }, status: 'ACTIVE' },
        ],
      });

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('INITIATED');
    });

    it('returns INITIATED when only one toolkit is active', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          { id: 'conn-1', toolkit: { slug: 'googledocs' }, status: 'ACTIVE' },
          { id: 'conn-2', toolkit: { slug: 'googledrive' }, status: 'INACTIVE' },
        ],
      });

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('INITIATED');
    });

    it('returns INACTIVE when no connected accounts found', async () => {
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('INACTIVE');
    });

    it('returns FAILED when connectedAccounts.list() throws', async () => {
      mockConnectedAccountsList.mockRejectedValue(new Error('Network error'));

      const client = await createComposioClient('user-1');
      const result = await client.checkConnection('user-1');

      expect(result.connected).toBe(false);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('initiateConnection via session.authorize()', () => {
    it('calls session.authorize() for both GOOGLEDOCS and GOOGLEDRIVE', async () => {
      mockSessionAuthorize.mockResolvedValue({
        redirectUrl: 'https://connect.composio.dev/link/test',
      });
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-1');
      const result = await client.initiateConnection('user-1');

      expect(mockSessionAuthorize).toHaveBeenCalledTimes(2);
      expect(mockSessionAuthorize).toHaveBeenNthCalledWith(1, 'GOOGLEDOCS', expect.objectContaining({
        callbackUrl: expect.stringContaining('/api/composio/callback'),
      }));
      expect(mockSessionAuthorize).toHaveBeenNthCalledWith(2, 'GOOGLEDRIVE', expect.objectContaining({
        callbackUrl: expect.stringContaining('/api/composio/callback'),
      }));
      expect(result).toBe('https://connect.composio.dev/link/test');
    });

    it('passes authConfigId to composio.create() with full config when provided', async () => {
      mockSessionAuthorize.mockResolvedValue({
        redirectUrl: 'https://connect.composio.dev/link/custom',
      });
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-1', {
        googleAuthConfigId: 'ac_custom_config',
      });
      await client.initiateConnection('user-1');

      expect(mockComposioCreate).toHaveBeenCalledWith('user-1', expect.objectContaining({
        toolkits: ['googledocs', 'googledrive'],
        authConfigs: {
          googledocs: 'ac_custom_config',
          googledrive: 'ac_custom_config',
        },
        manageConnections: { waitForConnections: true },
      }));

      expect(mockSessionAuthorize).toHaveBeenCalledTimes(2);
      expect(mockSessionAuthorize).toHaveBeenNthCalledWith(1, 'GOOGLEDOCS', {
        callbackUrl: expect.stringContaining('/api/composio/callback'),
      });
      expect(mockSessionAuthorize).toHaveBeenNthCalledWith(2, 'GOOGLEDRIVE', {
        callbackUrl: expect.stringContaining('/api/composio/callback'),
      });
    });
  });

  describe('clearConnectedAccountIdCache', () => {
    it('clears session cache forcing new session on next request', async () => {
      mockSessionAuthorize.mockResolvedValue({ redirectUrl: 'https://connect.composio.dev/link/test' });
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-1');
      await client.initiateConnection('user-1');

      client.clearConnectedAccountIdCache('user-1');

      const client2 = await createComposioClient('user-1');
      await client2.initiateConnection('user-1');

      expect(mockComposioCreate).toHaveBeenCalledTimes(2);
    });
  });
});
