/**
 * Project-based collaboration types for multi-user contract management
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum ProjectRole {
  OWNER = "owner",
  EDITOR = "editor",
  VIEWER = "viewer",
}

export enum ProjectStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
  DELETED = "deleted",
}

export enum DocumentStatus {
  UPLOADED = "uploaded",
  PROCESSING = "processing",
  INDEXED = "indexed",
  ERROR = "error",
}

export enum PlaceholderStatus {
  EXTRACTED = "extracted",
  REVIEWED = "reviewed",
  CONFIRMED = "confirmed",
}

export enum InviteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  EXPIRED = "expired",
  REVOKED = "revoked",
}

export enum ActivityAction {
  CREATED = "created",
  UPLOADED = "uploaded",
  EXTRACTED = "extracted",
  EDITED = "edited",
  GENERATED = "generated",
  SHARED = "shared",
  JOINED = "joined",
  LEFT = "left",
  ROLE_CHANGED = "role_changed",
  COMMENTED = "commented",
  EXPORTED = "exported",
  DELETED = "deleted",
  SYNCED = "synced",
}

export enum ActivityTargetType {
  PROJECT = "project",
  DOCUMENT = "document",
  PLACEHOLDER = "placeholder",
  CONTRACT = "contract",
  MEMBER = "member",
}

// ============================================================================
// CORE PROJECT TYPES
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  // Denormalized counts for UI performance
  memberCount: number;
  documentCount: number;
  placeholderCount: number;
  contractCount: number;
  // Collaboration
  lastActivityAt?: string;
  lastActivityBy?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy: string;
  invitedAt: string;
  joinedAt?: string;
  // User info (denormalized for UI)
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  // Processing
  status: DocumentStatus;
  extractedEntities?: Record<string, any>;
  processingError?: string;
  // Metadata
  mimeType: string;
  storagePath: string;
}

export interface ProjectPlaceholder {
  id: string;
  projectId: string;
  key: string;
  value?: string;
  defaultValue?: string;
  // Source tracking
  source: string;
  sourceDocumentId?: string;
  // AI metadata
  confidence: number;
  aiSuggestions?: string[];
  // Status
  status: PlaceholderStatus;
  // Modification tracking
  modifiedBy?: string;
  modifiedAt?: string;
  modifiedByName?: string;
  // Versioning for conflict resolution
  version: number;
}

export interface ProjectContract {
  id: string;
  projectId: string;
  templateId: string;
  name: string;
  markdownContent: string;
  filledData: string; // JSON string of placeholder values
  generatedBy: string;
  generatedAt: string;
  // Export
  googleDocId?: string;
  googleDocLink?: string;
  lastSyncedAt?: string;
  // Versioning
  version: number;
  // Metadata
  wordCount?: number;
}

// ============================================================================
// ACTIVITY & INVITES
// ============================================================================

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  targetName: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  role: ProjectRole;
  invitedBy: string;
  invitedByName: string;
  invitedAt: string;
  expiresAt: string;
  status: InviteStatus;
  // Acceptance tracking
  acceptedAt?: string;
  acceptedByUserId?: string;
}

// ============================================================================
// PRESENCE & COLLABORATION
// ============================================================================

export interface UserPresence {
  userId: string;
  userName: string;
  userPhotoURL?: string;
  projectId: string;
  // What they're viewing/editing
  currentView?: string;
  currentEditing?: string;
  // Timestamps
  lastSeenAt: string;
  joinedAt: string;
}

export interface ConflictResolution {
  id: string;
  projectId: string;
  targetType: ActivityTargetType;
  targetId: string;
  localValue: string;
  serverValue: string;
  lastSyncedValue?: string;
  localTimestamp: string;
  serverTimestamp: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: "local" | "server" | "merged";
}

// ============================================================================
// OFFLINE QUEUE
// ============================================================================

export interface PendingAction {
  id: string;
  action: "create" | "update" | "delete";
  collection: string;
  documentId?: string;
  data?: Record<string, any>;
  timestamp: string;
  retryCount: number;
  lastError?: string;
  projectId: string;
}

// ============================================================================
// GOOGLE DOCS SYNC
// ============================================================================

export interface GoogleDocsSyncConfig {
  id: string;
  projectId: string;
  contractId: string;
  googleDocId: string;
  syncDirection: "bidirectional" | "firestore-to-docs" | "docs-to-firestore";
  conflictResolution: "manual" | "firestore-wins" | "docs-wins";
  enabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "error" | "conflict";
  webhookUrl?: string;
  webhookSecret?: string;
}

export interface SyncEvent {
  id: string;
  configId: string;
  projectId: string;
  contractId: string;
  direction: "firestore-to-docs" | "docs-to-firestore";
  status: "pending" | "in-progress" | "success" | "error" | "conflict";
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  changesSummary?: {
    firestoreVersion: number;
    docsVersion: number;
    charactersChanged: number;
  };
}

// ============================================================================
// LEGACY TYPES (for backward compatibility during migration)
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description: string;
  markdownContent: string;
  googleDocLink?: string;
  isNew?: boolean;
  contractTypes?: string[];
}

export interface Contract {
  id: string;
  contractModelId?: string;
  clientName: string;
  filledData: string;
  name: string;
  markdownContent: string;
  googleDocLink?: string;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  file: File;
}

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

export const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  [ProjectRole.VIEWER]: 1,
  [ProjectRole.EDITOR]: 2,
  [ProjectRole.OWNER]: 3,
};

export function hasPermission(
  userRole: ProjectRole,
  requiredRole: ProjectRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canEdit(userRole: ProjectRole): boolean {
  return hasPermission(userRole, ProjectRole.EDITOR);
}

export function canManageMembers(userRole: ProjectRole): boolean {
  return hasPermission(userRole, ProjectRole.EDITOR);
}

export function canDeleteProject(userRole: ProjectRole): boolean {
  return userRole === ProjectRole.OWNER;
}

export function canChangeRoles(userRole: ProjectRole): boolean {
  return userRole === ProjectRole.OWNER;
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface ProjectCardData extends Project {
  memberPreview?: ProjectMember[];
  myRole: ProjectRole;
  unreadActivityCount?: number;
}

export interface PlaceholderEditEvent {
  placeholderId: string;
  key: string;
  oldValue?: string;
  newValue: string;
  editedBy: string;
  editedByName: string;
  timestamp: string;
}

export interface BatchPlaceholderUpdate {
  placeholderId: string;
  value: string;
}
