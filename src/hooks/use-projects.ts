'use client';

/**
 * Custom hooks for project-based collaboration
 * Provides real-time data synchronization with Firestore
 */

import { useMemo, useCallback, useEffect } from 'react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  DocumentReference,
  writeBatch,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useFirebase, useUser, useCollection, useDoc } from '@/firebase';
import type {
  Project,
  ProjectMember,
  ProjectDocument,
  ProjectPlaceholder,
  ProjectContract,
  Activity,
  ProjectInvite,
  UserPresence,
  ProjectRole,
  InviteStatus,
  Contract,
} from '@/lib/types';
import { canEdit, canManageMembers, canDeleteProject, canChangeRoles } from '@/lib/types';

// ============================================================================
// PROJECT HOOK
// ============================================================================

interface UseProjectReturn {
  project: Project | null;
  isLoading: boolean;
  error: Error | null;
  updateProject: (updates: Partial<Project>) => Promise<void>;
  archiveProject: () => Promise<void>;
  deleteProject: () => Promise<void>;
}

export function useProject(projectId: string | null): UseProjectReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const projectRef = useMemo(() => {
    if (!firestore || !projectId) return null;
    return doc(firestore, 'projects', projectId) as DocumentReference<Project>;
  }, [firestore, projectId]);

  const { data: project, isLoading, error } = useDoc<Project>(projectRef);

  const updateProject = useCallback(
    async (updates: Partial<Project>) => {
      if (!projectRef || !user) return;
      await updateDoc(projectRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    },
    [projectRef, user]
  );

  const archiveProject = useCallback(async () => {
    if (!projectRef || !user) return;
    await updateDoc(projectRef, {
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });
  }, [projectRef, user]);

  const deleteProject = useCallback(async () => {
    if (!projectRef || !user) return;
    await updateDoc(projectRef, {
      status: 'deleted',
      updatedAt: new Date().toISOString(),
    });
  }, [projectRef, user]);

  return {
    project,
    isLoading,
    error,
    updateProject,
    archiveProject,
    deleteProject,
  };
}

// ============================================================================
// USER'S PROJECTS HOOK
// ============================================================================

interface ProjectWithRole extends Project {
  myRole: ProjectRole;
}

interface UseUserProjectsReturn {
  projects: (ProjectWithRole & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUserProjects(): UseUserProjectsReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  // First, get all memberships for the current user
  const membershipsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'projectMembers'),
      where('userId', '==', user.uid),
      orderBy('joinedAt', 'desc')
    );
  }, [firestore, user]);

  const { data: memberships, isLoading: membershipsLoading, error: membershipsError } = 
    useCollection<ProjectMember>(membershipsQuery);

  // Get project IDs from memberships
  const projectIds = useMemo(() => {
    if (!memberships) return [];
    return memberships.map((m: ProjectMember) => m.projectId);
  }, [memberships]);

  // Create role lookup map
  const roleMap = useMemo(() => {
    const map = new Map<string, ProjectRole>();
    memberships?.forEach((m: ProjectMember) => map.set(m.projectId, m.role));
    return map;
  }, [memberships]);

  // Query for active projects - need to handle Firestore limitation of 10 items in 'in' clause
  const projectsQuery = useMemo(() => {
    if (!firestore || projectIds.length === 0) return null;
    // For now, query without 'in' to avoid limitation, filter client-side
    return query(
      collection(firestore, 'projects'),
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );
  }, [firestore, projectIds]);

  const { data: projects, isLoading: projectsLoading, error: projectsError } = 
    useCollection<Project>(projectsQuery);

  // Combine projects with roles and filter to only user's projects
  const projectsWithRoles = useMemo(() => {
    if (!projects) return null;
    return projects
      .filter((project: Project & { id: string }) => roleMap.has(project.id))
      .map((project: Project & { id: string }) => ({
        ...project,
        myRole: (roleMap.get(project.id) || 'viewer') as ProjectRole,
      }));
  }, [projects, roleMap]);

  return {
    projects: projectsWithRoles,
    isLoading: membershipsLoading || projectsLoading,
    error: membershipsError || projectsError,
  };
}

// ============================================================================
// PROJECT MEMBERS HOOK
// ============================================================================

interface UseProjectMembersReturn {
  members: (ProjectMember & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  inviteMember: (email: string, role: ProjectRole) => Promise<void>;
  updateMemberRole: (memberId: string, newRole: ProjectRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

export function useProjectMembers(projectId: string | null): UseProjectMembersReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const membersQuery = useMemo(() => {
    if (!firestore || !projectId) return null;
    return query(
      collection(firestore, 'projectMembers'),
      where('projectId', '==', projectId),
      orderBy('joinedAt', 'desc')
    );
  }, [firestore, projectId]);

  const { data: members, isLoading, error } = useCollection<ProjectMember>(membersQuery);

  const inviteMember = useCallback(
    async (email: string, role: ProjectRole) => {
      if (!firestore || !projectId || !user) return;
      
      const inviteData = {
        projectId,
        projectName: '', // Will be filled by Cloud Function
        email: email.toLowerCase(),
        role,
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || 'Unknown',
        invitedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        status: 'pending' as InviteStatus,
      };

      await addDoc(collection(firestore, 'invites'), inviteData);
    },
    [firestore, projectId, user]
  );

  const updateMemberRole = useCallback(
    async (memberId: string, newRole: ProjectRole) => {
      if (!firestore) return;
      const memberRef = doc(firestore, 'projectMembers', memberId);
      await updateDoc(memberRef, { role: newRole });
    },
    [firestore]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!firestore) return;
      const memberRef = doc(firestore, 'projectMembers', memberId);
      await deleteDoc(memberRef);
    },
    [firestore]
  );

  return {
    members,
    isLoading,
    error,
    inviteMember,
    updateMemberRole,
    removeMember,
  };
}

// ============================================================================
// PROJECT ROLE HOOK
// ============================================================================

interface UseProjectRoleReturn {
  role: ProjectRole | null;
  isLoading: boolean;
  error: Error | null;
}

export function useProjectRole(projectId: string | null): UseProjectRoleReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const memberRef = useMemo(() => {
    if (!firestore || !projectId || !user) return null;
    return doc(firestore, 'projectMembers', `${projectId}_${user.uid}`) as DocumentReference<ProjectMember>;
  }, [firestore, projectId, user]);

  const { data: membership, isLoading, error } = useDoc<ProjectMember>(memberRef);

  return {
    role: membership?.role || null,
    isLoading,
    error,
  };
}

// ============================================================================
// PERMISSION HOOK
// ============================================================================

interface UsePermissionReturn {
  canView: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  canDeleteProject: boolean;
  canChangeRoles: boolean;
  isLoading: boolean;
}

export function usePermission(projectId: string | null): UsePermissionReturn {
  const { role, isLoading } = useProjectRole(projectId);

  return useMemo(() => {
    if (!role) {
      return {
        canView: false,
        canEdit: false,
        canManageMembers: false,
        canDeleteProject: false,
        canChangeRoles: false,
        isLoading,
      };
    }

    return {
      canView: true,
      canEdit: canEdit(role),
      canManageMembers: canManageMembers(role),
      canDeleteProject: canDeleteProject(role),
      canChangeRoles: canChangeRoles(role),
      isLoading,
    };
  }, [role, isLoading]);
}

// ============================================================================
// PROJECT DOCUMENTS HOOK
// ============================================================================

interface UseProjectDocumentsReturn {
  documents: (ProjectDocument & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  addDocument: (docData: Omit<ProjectDocument, 'id'>) => Promise<string>;
  updateDocument: (docId: string, updates: Partial<ProjectDocument>) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
}

export function useProjectDocuments(projectId: string | null): UseProjectDocumentsReturn {
  const { firestore } = useFirebase();

  const documentsQuery = useMemo(() => {
    if (!firestore || !projectId) return null;
    return query(
      collection(firestore, 'projectDocuments'),
      where('projectId', '==', projectId),
      orderBy('uploadedAt', 'desc')
    );
  }, [firestore, projectId]);

  const { data: documents, isLoading, error } = useCollection<ProjectDocument>(documentsQuery);

  const addDocument = useCallback(
    async (docData: Omit<ProjectDocument, 'id'>) => {
      if (!firestore) throw new Error('Firestore not initialized');
      const docRef = await addDoc(collection(firestore, 'projectDocuments'), docData);
      return docRef.id;
    },
    [firestore]
  );

  const updateDocument = useCallback(
    async (docId: string, updates: Partial<ProjectDocument>) => {
      if (!firestore) return;
      const docRef = doc(firestore, 'projectDocuments', docId);
      await updateDoc(docRef, updates);
    },
    [firestore]
  );

  const deleteDocument = useCallback(
    async (docId: string) => {
      if (!firestore) return;
      const docRef = doc(firestore, 'projectDocuments', docId);
      await deleteDoc(docRef);
    },
    [firestore]
  );

  return {
    documents,
    isLoading,
    error,
    addDocument,
    updateDocument,
    deleteDocument,
  };
}

// ============================================================================
// PROJECT PLACEHOLDERS HOOK
// ============================================================================

interface PlaceholderUpdate {
  placeholderId: string;
  value: string;
}

interface UseProjectPlaceholdersReturn {
  placeholders: (ProjectPlaceholder & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  updatePlaceholder: (placeholderId: string, value: string) => Promise<void>;
  updatePlaceholdersBatch: (updates: PlaceholderUpdate[]) => Promise<void>;
  confirmPlaceholder: (placeholderId: string) => Promise<void>;
}

export function useProjectPlaceholders(projectId: string | null): UseProjectPlaceholdersReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const placeholdersQuery = useMemo(() => {
    if (!firestore || !projectId) return null;
    return query(
      collection(firestore, 'projectPlaceholders'),
      where('projectId', '==', projectId),
      orderBy('key', 'asc')
    );
  }, [firestore, projectId]);

  const { data: placeholders, isLoading, error } = useCollection<ProjectPlaceholder>(placeholdersQuery);

  const updatePlaceholder = useCallback(
    async (placeholderId: string, value: string) => {
      if (!firestore || !user) return;
      const placeholderRef = doc(firestore, 'projectPlaceholders', placeholderId);
      const currentPlaceholder = placeholders?.find((p: ProjectPlaceholder & { id: string }) => p.id === placeholderId);
      await updateDoc(placeholderRef, {
        value,
        modifiedBy: user.uid,
        modifiedByName: user.displayName || user.email || 'Unknown',
        modifiedAt: new Date().toISOString(),
        status: 'reviewed',
        version: (currentPlaceholder?.version || 0) + 1,
      });
    },
    [firestore, user, placeholders]
  );

  const updatePlaceholdersBatch = useCallback(
    async (updates: PlaceholderUpdate[]) => {
      if (!firestore || !user) return;
      
      const batch = writeBatch(firestore);
      updates.forEach(({ placeholderId, value }) => {
        const placeholderRef = doc(firestore, 'projectPlaceholders', placeholderId);
        const currentPlaceholder = placeholders?.find((p: ProjectPlaceholder & { id: string }) => p.id === placeholderId);
        batch.update(placeholderRef, {
          value,
          modifiedBy: user.uid,
          modifiedByName: user.displayName || user.email || 'Unknown',
          modifiedAt: new Date().toISOString(),
          status: 'reviewed',
          version: (currentPlaceholder?.version || 0) + 1,
        });
      });
      await batch.commit();
    },
    [firestore, user, placeholders]
  );

  const confirmPlaceholder = useCallback(
    async (placeholderId: string) => {
      if (!firestore) return;
      const placeholderRef = doc(firestore, 'projectPlaceholders', placeholderId);
      await updateDoc(placeholderRef, { status: 'confirmed' });
    },
    [firestore]
  );

  return {
    placeholders,
    isLoading,
    error,
    updatePlaceholder,
    updatePlaceholdersBatch,
    confirmPlaceholder,
  };
}

// ============================================================================
// PROJECT CONTRACTS HOOK
// ============================================================================

interface UseProjectContractsReturn {
  contracts: (ProjectContract & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  addContract: (contract: Omit<ProjectContract, 'id'>) => Promise<string>;
  updateContract: (contractId: string, updates: Partial<ProjectContract>) => Promise<void>;
  deleteContract: (contractId: string) => Promise<void>;
}

export function useProjectContracts(projectId: string | null): UseProjectContractsReturn {
  const { firestore } = useFirebase();

  const contractsQuery = useMemo(() => {
    if (!firestore || !projectId) return null;
    return query(
      collection(firestore, 'projectContracts'),
      where('projectId', '==', projectId),
      orderBy('generatedAt', 'desc')
    );
  }, [firestore, projectId]);

  const { data: contracts, isLoading, error } = useCollection<ProjectContract>(contractsQuery);

  const addContract = useCallback(
    async (contract: Omit<ProjectContract, 'id'>) => {
      if (!firestore) throw new Error('Firestore not initialized');
      const docRef = await addDoc(collection(firestore, 'projectContracts'), contract);
      return docRef.id;
    },
    [firestore]
  );

  const updateContract = useCallback(
    async (contractId: string, updates: Partial<ProjectContract>) => {
      if (!firestore) return;
      const contractRef = doc(firestore, 'projectContracts', contractId);
      await updateDoc(contractRef, updates);
    },
    [firestore]
  );

  const deleteContract = useCallback(
    async (contractId: string) => {
      if (!firestore) return;
      const contractRef = doc(firestore, 'projectContracts', contractId);
      await deleteDoc(contractRef);
    },
    [firestore]
  );

  return {
    contracts,
    isLoading,
    error,
    addContract,
    updateContract,
    deleteContract,
  };
}

// ============================================================================
// ACTIVITY HOOK
// ============================================================================

interface UseActivityReturn {
  activities: (Activity & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  logActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => Promise<void>;
}

export function useActivity(projectId: string | null, pageSize: number = 50): UseActivityReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const activityQuery = useMemo(() => {
    if (!firestore || !projectId) return null;
    return query(
      collection(firestore, 'activity'),
      where('projectId', '==', projectId),
      orderBy('timestamp', 'desc'),
      limit(pageSize)
    );
  }, [firestore, projectId, pageSize]);

  const { data: activities, isLoading, error } = useCollection<Activity>(activityQuery);

  const logActivity = useCallback(
    async (activity: Omit<Activity, 'id' | 'timestamp'>) => {
      if (!firestore || !user) return;
      await addDoc(collection(firestore, 'activity'), {
        ...activity,
        timestamp: new Date().toISOString(),
      });
    },
    [firestore, user]
  );

  return {
    activities,
    isLoading,
    error,
    hasMore: false, // TODO: Implement pagination
    loadMore: () => {}, // TODO: Implement pagination
    logActivity,
  };
}

// ============================================================================
// INVITES HOOK
// ============================================================================

interface UseInvitesReturn {
  pendingInvites: (ProjectInvite & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
}

export function useInvites(): UseInvitesReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const invitesQuery = useMemo(() => {
    if (!firestore || !user?.email) return null;
    return query(
      collection(firestore, 'invites'),
      where('email', '==', user.email.toLowerCase()),
      where('status', '==', 'pending'),
      orderBy('invitedAt', 'desc')
    );
  }, [firestore, user]);

  const { data: invites, isLoading, error } = useCollection<ProjectInvite>(invitesQuery);

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      if (!firestore || !user) return;
      
      const inviteRef = doc(firestore, 'invites', inviteId);
      const inviteDoc = await getDoc(inviteRef);
      
      if (!inviteDoc.exists()) return;
      const inviteData = inviteDoc.data() as ProjectInvite;
      
      // Create membership
      const memberRef = doc(firestore, 'projectMembers', `${inviteData.projectId}_${user.uid}`);
      await setDoc(memberRef, {
        projectId: inviteData.projectId,
        userId: user.uid,
        role: inviteData.role,
        invitedBy: inviteData.invitedBy,
        invitedAt: inviteData.invitedAt,
        joinedAt: new Date().toISOString(),
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      
      // Update invite
      await updateDoc(inviteRef, {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        acceptedByUserId: user.uid,
      });
    },
    [firestore, user]
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      if (!firestore) return;
      const inviteRef = doc(firestore, 'invites', inviteId);
      await updateDoc(inviteRef, {
        status: 'revoked',
      });
    },
    [firestore]
  );

  return {
    pendingInvites: invites,
    isLoading,
    error,
    acceptInvite,
    declineInvite,
  };
}

// ============================================================================
// PRESENCE HOOK
// ============================================================================

interface UsePresenceReturn {
  activeUsers: (UserPresence & { id: string })[] | null;
  isLoading: boolean;
  error: Error | null;
  updatePresence: (updates: Partial<UserPresence>) => Promise<void>;
}

export function usePresence(projectId: string | null): UsePresenceReturn {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const presenceQuery = useMemo(() => {
    if (!firestore || !projectId) return null;
    // Only show users active in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return query(
      collection(firestore, 'presence'),
      where('projectId', '==', projectId),
      where('lastSeenAt', '>=', fiveMinutesAgo),
      orderBy('lastSeenAt', 'desc')
    );
  }, [firestore, projectId]);

  const { data: presence, isLoading, error } = useCollection<UserPresence>(presenceQuery);

  const updatePresence = useCallback(
    async (updates: Partial<UserPresence>) => {
      if (!firestore || !projectId || !user) return;
      
      const presenceId = `${projectId}_${user.uid}`;
      const presenceRef = doc(firestore, 'presence', presenceId);
      
      await setDoc(presenceRef, {
        userId: user.uid,
        userName: user.displayName || user.email || 'Unknown',
        userPhotoURL: user.photoURL,
        projectId,
        lastSeenAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        ...updates,
      }, { merge: true });
    },
    [firestore, projectId, user]
  );

  // Heartbeat to keep presence alive
  useEffect(() => {
    if (!projectId || !user) return;
    
    const interval = setInterval(() => {
      updatePresence({});
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [projectId, user, updatePresence]);

  return {
    activeUsers: presence,
    isLoading,
    error,
    updatePresence,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY HOOKS
// ============================================================================

/**
 * @deprecated Use useUserProjects instead
 * Maintains compatibility during migration period
 */
export function useLegacyContracts() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const contractsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [firestore, user]);

  return useCollection<Contract>(contractsQuery);
}
