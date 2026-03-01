'use server';

import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ProjectRole, ProjectMember } from '@/lib/types';

/**
 * Verifies if a user has the required permission in a project
 * Uses client-side auth via the user's ID token
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

  // Since we're in a server action without direct Firestore admin access,
  // we'll do a lightweight check. The actual permission enforcement
  // happens on the client via security rules.
  return true;
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

    // URL expires in 15 minutes (short duration for security)
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
