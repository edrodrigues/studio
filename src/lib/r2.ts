import { S3Client } from '@aws-sdk/client-s3';

/**
 * Gets the R2 client instance.
 * Initialized lazily to ensure environment variables are loaded.
 *
 * IMPORTANT: This function will throw a clear error if any required R2
 * environment variables are missing, preventing silent upload failures.
 */
let client: S3Client | null = null;
let configError: string | null = null;

export function getR2Client(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  const missing: string[] = [];
  if (!accountId) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');

  if (missing.length > 0) {
    configError = `Cloudflare R2 não está configurado. Variáveis de ambiente ausentes: ${missing.join(', ')}. Contate o administrador do sistema.`;
    console.error(configError);
    throw new Error(configError);
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
    forcePathStyle: true,
    // Disable automatic checksum injection. AWS SDK v3 adds x-amz-checksum-crc32
    // and x-amz-sdk-checksum-algorithm to presigned URLs by default, but these
    // headers are NOT included in X-Amz-SignedHeaders, causing Cloudflare R2
    // to reject the CORS preflight from the browser with ERR_FAILED.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  return client;
}

/**
 * Returns true if R2 is properly configured (all required env vars present).
 * Use this to check config at startup or before upload attempts without throwing.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

// Keep the export for backward compatibility if needed, but getR2Client() is preferred
export const r2Client = new Proxy({} as S3Client, {
  get: (target, prop, receiver) => {
    return Reflect.get(getR2Client(), prop, receiver);
  }
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vlab-contracts-storage';
