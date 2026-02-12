'use client';

/**
 * Offline-first synchronization system
 * Provides offline persistence, queue management, and conflict resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';
import { useFirebase } from '@/firebase';
import { enableIndexedDbPersistence, disableNetwork } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { PendingAction } from '@/lib/types';

// ============================================================================
// TYPES
// ============================================================================

interface CachedData {
  data: unknown;
  timestamp: string;
  version: number;
}

interface ConflictData {
  id: string;
  projectId: string;
  targetType: string;
  targetId: string;
  localValue: string;
  serverValue: string;
  lastSyncedValue?: string;
  localTimestamp: string;
  serverTimestamp: string;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merged';
  mergedValue?: string;
  resolvedAt?: string;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

const DB_NAME = 'assistente-contratos-offline';
const DB_VERSION = 1;

let dbPromise: ReturnType<typeof openDB> | null = null;

export function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Pending actions store
        const pendingStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
        pendingStore.createIndex('by-project', 'projectId');
        pendingStore.createIndex('by-timestamp', 'timestamp');

        // Cache store
        db.createObjectStore('cache', { keyPath: 'key' });

        // Conflicts store
        const conflictsStore = db.createObjectStore('conflicts', { keyPath: 'id' });
        conflictsStore.createIndex('by-project', 'projectId');
      },
    });
  }
  return dbPromise;
}

// ============================================================================
// OFFLINE STATUS HOOK
// ============================================================================

interface UseOfflineStatusReturn {
  isOnline: boolean;
  isPendingSync: boolean;
  pendingCount: number;
  enableOffline: () => Promise<void>;
  disableOffline: () => Promise<void>;
}

export function useOfflineStatus(): UseOfflineStatusReturn {
  const { firestore } = useFirebase();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const db = await getOfflineDB();
        const count = await db.count('pendingActions');
        setPendingCount(count);
      } catch (error) {
        console.error('Error counting pending actions:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => clearInterval(interval);
  }, []);

  const enableOffline = useCallback(async () => {
    if (!firestore) return;
    try {
      await enableIndexedDbPersistence(firestore);
      console.log('Offline persistence enabled');
    } catch (error) {
      console.error('Error enabling offline persistence:', error);
    }
  }, [firestore]);

  const disableOffline = useCallback(async () => {
    if (!firestore) return;
    try {
      await disableNetwork(firestore);
      console.log('Network disabled');
    } catch (error) {
      console.error('Error disabling network:', error);
    }
  }, [firestore]);

  return {
    isOnline,
    isPendingSync: pendingCount > 0,
    pendingCount,
    enableOffline,
    disableOffline,
  };
}

// ============================================================================
// PENDING ACTIONS QUEUE
// ============================================================================

export async function addPendingAction(action: Omit<PendingAction, 'id'>): Promise<string> {
  const db = await getOfflineDB();
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const pendingAction: PendingAction = {
    ...action,
    id,
    retryCount: 0,
  };
  
  await db.add('pendingActions', pendingAction);
  return id;
}

export async function getPendingActions(projectId?: string): Promise<PendingAction[]> {
  const db = await getOfflineDB();
  
  if (projectId) {
    const tx = db.transaction('pendingActions', 'readonly');
    const index = tx.store.index('by-project');
    return index.getAll(projectId);
  }
  
  return db.getAll('pendingActions');
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('pendingActions', id);
}

export async function updatePendingAction(id: string, updates: Partial<PendingAction>): Promise<void> {
  const db = await getOfflineDB();
  const action = await db.get('pendingActions', id);
  if (action) {
    await db.put('pendingActions', { ...action, ...updates });
  }
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = await getOfflineDB();
  const action = await db.get('pendingActions', id);
  if (action) {
    await db.put('pendingActions', { 
      ...action, 
      retryCount: action.retryCount + 1 
    });
  }
}

// ============================================================================
// CONFLICT MANAGEMENT
// ============================================================================

export async function addConflict(conflict: Omit<ConflictData, 'id' | 'resolved'>): Promise<string> {
  const db = await getOfflineDB();
  const id = `${conflict.projectId}_${conflict.targetId}`;
  
  await db.put('conflicts', {
    ...conflict,
    id,
    resolved: false,
  });
  
  return id;
}

export async function getConflicts(projectId?: string): Promise<ConflictData[]> {
  const db = await getOfflineDB();
  
  if (projectId) {
    const tx = db.transaction('conflicts', 'readonly');
    const index = tx.store.index('by-project');
    return index.getAll(projectId);
  }
  
  return db.getAll('conflicts');
}

export async function resolveConflict(
  id: string, 
  resolution: 'local' | 'server' | 'merged', 
  mergedValue?: string
): Promise<void> {
  const db = await getOfflineDB();
  const conflict = await db.get('conflicts', id);
  
  if (conflict) {
    const updated: ConflictData = {
      ...conflict,
      resolved: true,
      resolution,
      mergedValue,
      resolvedAt: new Date().toISOString(),
    };
    await db.put('conflicts', updated);
  }
}

// ============================================================================
// SYNC ENGINE
// ============================================================================

export class SyncEngine {
  private isSyncing = false;
  private abortController: AbortController | null = null;

  async sync(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.abortController = new AbortController();

    let success = 0;
    let failed = 0;

    try {
      const actions = await getPendingActions();
      
      for (const action of actions) {
        if (this.abortController.signal.aborted) {
          break;
        }

        try {
          await this.processAction(action);
          await removePendingAction(action.id);
          success++;
        } catch (error) {
          console.error('Error processing action:', action, error);
          await incrementRetryCount(action.id);
          failed++;
        }
      }
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }

    return { success, failed };
  }

  private async processAction(action: PendingAction): Promise<void> {
    // This will be implemented with actual Firestore operations
    // For now, it's a placeholder
    console.log('Processing action:', action);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

// ============================================================================
// OFFLINE QUEUE HOOK
// ============================================================================

interface UseOfflineQueueReturn {
  pendingActions: PendingAction[];
  isSyncing: boolean;
  sync: () => Promise<void>;
  retryAction: (id: string) => Promise<void>;
  cancelAction: (id: string) => Promise<void>;
}

export function useOfflineQueue(projectId?: string): UseOfflineQueueReturn {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadActions = async () => {
      const actions = await getPendingActions(projectId);
      setPendingActions(actions);
    };

    loadActions();
    const interval = setInterval(loadActions, 3000);

    return () => clearInterval(interval);
  }, [projectId]);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    const engine = new SyncEngine();
    
    try {
      const result = await engine.sync();
      
      if (result.failed === 0) {
        toast({
          title: 'Sincronização concluída',
          description: `${result.success} ações sincronizadas com sucesso.`,
        });
      } else {
        toast({
          title: 'Sincronização parcial',
          description: `${result.success} sincronizadas, ${result.failed} falharam.`,
          variant: 'destructive',
        });
      }
      
      // Refresh list
      const actions = await getPendingActions(projectId);
      setPendingActions(actions);
    } catch (error) {
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar as alterações.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [projectId, toast]);

  const retryAction = useCallback(async (id: string) => {
    await incrementRetryCount(id);
    await sync();
  }, [sync]);

  const cancelAction = useCallback(async (id: string) => {
    await removePendingAction(id);
    const actions = await getPendingActions(projectId);
    setPendingActions(actions);
    
    toast({
      title: 'Ação cancelada',
      description: 'A alteração foi removida da fila.',
    });
  }, [projectId, toast]);

  return {
    pendingActions,
    isSyncing,
    sync,
    retryAction,
    cancelAction,
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initializeOfflineSync(): Promise<void> {
  try {
    // Initialize IndexedDB
    await getOfflineDB();
    
    console.log('Offline sync initialized');
  } catch (error) {
    console.error('Error initializing offline sync:', error);
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export async function setCache(key: string, data: unknown): Promise<void> {
  const db = await getOfflineDB();
  await db.put('cache', {
    key,
    data,
    timestamp: new Date().toISOString(),
    version: 1,
  });
}

export async function getCache(key: string): Promise<CachedData | undefined> {
  const db = await getOfflineDB();
  return db.get('cache', key);
}

export async function clearCache(): Promise<void> {
  const db = await getOfflineDB();
  await db.clear('cache');
}
