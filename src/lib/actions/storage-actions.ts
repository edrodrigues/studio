'use server';

import { getR2Client, isR2Configured, R2_BUCKET_NAME } from '@/lib/r2';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ProjectRole, ProjectMember } from '@/lib/types';
import { db } from '@/lib/firebase-server';

/**
 * Verifies if a user has the required permission in a project
 * Uses Firebase Admin SDK to check actual membership and role
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
    const memberDoc = await db.doc(`projectMembers/${projectId}_${userId}`).get();
    if (!memberDoc.exists) return false;
    
    const member = memberDoc.data() as { role?: string };
    const userRoleLevel = ROLE_HIERARCHY[member.role || ''] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    return userRoleLevel >= requiredRoleLevel;
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
  // 0. Fail fast if R2 is not configured
  if (!isR2Configured()) {
    return {
      success: false,
      error: 'Armazenamento em nuvem não configurado. As variáveis de ambiente do Cloudflare R2 estão ausentes. Contate o administrador do sistema. (R2 credentials missing)',
    };
  }

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
    const client = getR2Client();

    // 3. Generate presigned URL for PUT
    // Note: checksumAlgorithm must NOT be set here. AWS SDK v3 adds
    // x-amz-checksum-crc32 and x-amz-sdk-checksum-algorithm headers by
    // default, but they are not included in X-Amz-SignedHeaders, causing
    // Cloudflare R2 to reject the CORS preflight from the browser.
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // URL expires in 1 hour. unhoistableHeaders forces Content-Type into the
    // signed headers so the browser PUT matches the signature exactly.
    const url = await getSignedUrl(client, command, {
      expiresIn: 3600,
      unhoistableHeaders: new Set(['content-type']),
    });

    return { 
      success: true, 
      url, 
      key,
      bucket: R2_BUCKET_NAME
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    
    const rootCause = error instanceof Error ? error.message : String(error);
    const isConfigError = rootCause.includes('R2') || rootCause.includes('credentials') || rootCause.includes('configura');
    
    return { 
      success: false, 
      error: isConfigError
        ? `Configuração do armazenamento incompleta: ${rootCause}`
        : `Erro ao gerar URL de upload: ${rootCause}`,
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
  // 0. Fail fast if R2 is not configured
  if (!isR2Configured()) {
    return {
      success: false,
      error: 'Armazenamento em nuvem não configurado. Contate o administrador do sistema.',
    };
  }

  // 1. Verify permission (must be at least VIEWER to download)
  const hasPermission = await checkProjectPermission(projectId, userId, ProjectRole.VIEWER);
  if (!hasPermission) {
    throw new Error('Unauthorized: You do not have permission to view files in this project.');
  }

  try {
    const client = getR2Client();

    // 2. Generate presigned URL for GET
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    // URL expires in 15 minutes (short duration for security)
    const url = await getSignedUrl(client, command, { expiresIn: 900 });

    return { 
      success: true, 
      url 
    };
  } catch (error) {
    console.error('Error generating download URL:', error);

    const rootCause = error instanceof Error ? error.message : String(error);
    
    return { 
      success: false, 
      error: `Erro ao gerar URL de download: ${rootCause}`,
    };
  }
}
