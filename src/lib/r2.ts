import { S3Client } from '@aws-sdk/client-s3';

/**
 * Gets the R2 client instance. 
 * Initialized lazily to ensure environment variables are loaded.
 */
let client: S3Client | null = null;

export function getR2Client() {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.warn('R2 configuration missing. Check environment variables.');
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || '',
    },
    forcePathStyle: true,
  });

  return client;
}

// Keep the export for backward compatibility if needed, but getR2Client() is preferred
export const r2Client = new Proxy({} as S3Client, {
  get: (target, prop, receiver) => {
    return Reflect.get(getR2Client(), prop, receiver);
  }
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vlab-contracts-storage';
