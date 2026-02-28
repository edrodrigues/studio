'use server';

import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '@/lib/firebase-server';
import { ProjectRole, ProjectMember } from '@/lib/types';

/**
 * Adds a member to a project by email
 * Looks up the user by email in projectMembers collection
 */
export async function addMemberToProject(
  projectId: string,
  inviteeEmail: string,
  role: ProjectRole,
  invitedByUid: string,
  invitedByName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = inviteeEmail.toLowerCase().trim();

    // Get all members of this project and check if user is already a member
    const allMembersSnapshot = await db.collection('projectMembers')
      .where('projectId', '==', projectId)
      .get();
    
    const existingMember = allMembersSnapshot.docs.find(
      doc => doc.data().email?.toLowerCase() === normalizedEmail
    );
    
    if (existingMember) {
      return { success: false, error: 'Este email já é membro deste projeto.' };
    }

    // Look up user by email in projectMembers (they must have been invited to another project before)
    const userLookupQuery = await db.collection('projectMembers')
      .where('email', '==', normalizedEmail)
      .get();

    if (userLookupQuery.empty) {
      return { 
        success: false, 
        error: 'Usuário não encontrado. O usuário precisa criar uma conta no sistema primeiro (fazer login pelo menos uma vez em algum projeto).' 
      };
    }

    // Get the user's UID from their existing membership
    const existingUserDoc = userLookupQuery.docs[0];
    const userData = existingUserDoc.data() as ProjectMember;
    const userId = userData.userId;

    const now = new Date().toISOString();

    // Add member to project
    const memberData = {
      projectId,
      userId,
      role,
      invitedBy: invitedByUid,
      invitedByName,
      invitedAt: now,
      joinedAt: now,
      email: normalizedEmail,
      displayName: userData.displayName || null,
      photoURL: userData.photoURL || null,
    };

    await db.collection('projectMembers').add(memberData);

    // Update project member count - get current count and increment
    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    
    if (projectSnap.exists) {
      const currentCount = projectSnap.data()?.memberCount || 0;
      await projectRef.update({
        memberCount: currentCount + 1,
        updatedAt: now,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding member to project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Erro ao adicionar membro ao projeto: ${errorMessage}` };
  }
}

/**
 * Verifies if a user has the required permission in a project
 */
async function checkProjectPermission(
  projectId: string, 
  userId: string, 
  requiredRole: ProjectRole = ProjectRole.VIEWER
): Promise<boolean> {
  const ROLE_HIERARCHY: Record<string, number> = {
    [ProjectRole.VIEWER]: 1,
    [ProjectRole.EDITOR]: 2,
    [ProjectRole.OWNER]: 3,
  };

  try {
    // Look in the correct collection: /projectMembers/{projectId}_{userId}
    const memberDocRef = db.collection('projectMembers').doc(`${projectId}_${userId}`);
    const memberDoc = await memberDocRef.get();

    if (!memberDoc.exists) {
      return false;
    }

    const memberData = memberDoc.data();
    const userRole = memberData?.role as ProjectRole;

    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  } catch (error) {
    console.error('Error checking project permission:', error);
    return false;
  }
}

/**
 * Generates a presigned URL for uploading a file to Cloudflare R2
 */
export async function getUploadUrl(
  projectId: string, 
  userId: string, 
  fileName: string, 
  contentType: string
) {
  // 1. Verify permission (must be at least EDITOR to upload)
  const hasPermission = await checkProjectPermission(projectId, userId, ProjectRole.EDITOR);
  if (!hasPermission) {
    throw new Error('Você não tem permissão para fazer upload neste projeto. Verifique se você é membro do projeto com acesso de editor.');
  }

  // 2. Generate storage key
  // Using a similar structure to the original Firebase path but adapted for R2
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `projects/${projectId}/documents/uploads/${timestamp}_${sanitizedFileName}`;

  try {
    // 3. Generate presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // URL expires in 1 hour
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    return { 
      success: true, 
      url, 
      key,
      bucket: R2_BUCKET_NAME
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return { 
      success: false, 
      error: 'Failed to generate upload URL' 
    };
  }
}

/**
 * Generates a presigned URL for downloading/viewing a file from Cloudflare R2
 */
export async function getDownloadUrl(
  projectId: string, 
  userId: string, 
  key: string
) {
  // 1. Verify permission (must be at least VIEWER to download)
  const hasPermission = await checkProjectPermission(projectId, userId, ProjectRole.VIEWER);
  if (!hasPermission) {
    throw new Error('Unauthorized: You do not have permission to view files in this project.');
  }

  try {
    // 2. Generate presigned URL for GET
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    // URL expires in 15 minutes (short duration for security, as per plan)
    const url = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    return { 
      success: true, 
      url 
    };
  } catch (error) {
    console.error('Error generating download URL:', error);
    return { 
      success: false, 
      error: 'Failed to generate download URL' 
    };
  }
}
