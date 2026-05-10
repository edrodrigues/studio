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
    it('returns cached result on second call for same userId', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          {
            id: 'acc-123',
            authConfig: { id: 'test-auth-config-id' },
            status: 'ACTIVE',
          },
        ],
      });

      const client = await createComposioClient('user-1');
      // Access internal method through cache check
      const result1 = await (client as any).getConnectedAccountId?.('user-1');
      const result2 = await (client as any).getConnectedAccountId?.('user-1');

      expect(mockConnectedAccountsList).toHaveBeenCalledTimes(1);
      expect(result1).toBe('acc-123');
      expect(result2).toBe('acc-123');
    });

    it('caches "not found" result for 30s', async () => {
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const client = await createComposioClient('user-2');
      const result1 = await (client as any).getConnectedAccountId?.('user-2');
      const result2 = await (client as any).getConnectedAccountId?.('user-2');

      expect(mockConnectedAccountsList).toHaveBeenCalledTimes(1);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it('clearConnectedAccountIdCache removes cache entry', async () => {
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          {
            id: 'acc-456',
            authConfig: { id: 'test-auth-config-id' },
            status: 'ACTIVE',
          },
        ],
      });

      const client = await createComposioClient('user-3');
      await (client as any).getConnectedAccountId?.('user-3');
      client.clearConnectedAccountIdCache('user-3');
      await (client as any).getConnectedAccountId?.('user-3');

      expect(mockConnectedAccountsList).toHaveBeenCalledTimes(2);
    });
  });
});
