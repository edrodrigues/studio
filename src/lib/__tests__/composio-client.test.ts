import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConnectedAccountsList, mockToolsExecute } = vi.hoisted(() => ({
  mockConnectedAccountsList: vi.fn(),
  mockToolsExecute: vi.fn(),
}));

vi.mock('@composio/core', () => ({
  Composio: vi.fn(function () {
    return {
      connectedAccounts: {
        list: mockConnectedAccountsList,
        initiate: vi.fn(),
      },
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

import { createComposioClient } from '../composio-client';

describe('composio-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID = 'test-auth-config-id';
  });

  describe('getConnectedAccountId caching', () => {
    it('reuses cached result across multiple client instances for same userId', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          {
            id: 'acc-123',
            authConfig: { id: 'test-auth-config-id' },
            status: 'ACTIVE',
          },
        ],
      });

      // First client triggers the API call
      const client1 = await createComposioClient('user-1');
      const status1 = await client1.checkConnection('user-1');
      expect(status1.connected).toBe(true);

      // Second client for same user should use cache (no additional API call)
      const client2 = await createComposioClient('user-1');
      const status2 = await client2.checkConnection('user-1');
      expect(status2.connected).toBe(true);

      // checkConnection calls list twice internally, but second client
      // benefits from the module-level cache for getConnectedAccountId
      // Expected: client1=2 calls, client2=1 call = 3 total
      expect(mockConnectedAccountsList).toHaveBeenCalledTimes(3);
    });

    it('clearConnectedAccountIdCache removes cache entry for a different user', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          {
            id: 'acc-456',
            authConfig: { id: 'test-auth-config-id' },
            status: 'ACTIVE',
          },
        ],
      });

      const client1 = await createComposioClient('user-3');
      await client1.checkConnection('user-3');

      // Clear cache for user-3
      client1.clearConnectedAccountIdCache('user-3');

      // Second client for same user should trigger new API call (cache cleared)
      const client2 = await createComposioClient('user-3');
      await client2.checkConnection('user-3');

      // After clearing cache, second client also makes 2 calls
      // Expected: first client=2 calls, second client=2 calls = 4 total
      expect(mockConnectedAccountsList).toHaveBeenCalledTimes(4);
    });
  });
});
