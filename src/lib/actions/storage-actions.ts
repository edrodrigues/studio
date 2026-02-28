'use server';

import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '@/lib/firebase-server';
import { ProjectRole } from '@/lib/types';

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
    const membersRef = db.collection('projects').doc(projectId).collection('members');
    const snapshot = await membersRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return false;
    }

    const memberData = snapshot.docs[0].data();
    const userRole = memberData.role as ProjectRole;

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
    throw new Error('Unauthorized: You do not have permission to upload to this project.');
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
