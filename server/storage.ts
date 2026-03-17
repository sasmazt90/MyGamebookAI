/**
 * Storage helpers using Cloudflare R2 (S3-compatible API).
 * Uses @aws-sdk/client-s3 for reliable AWS4 signing.
 * Environment variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_BASE_URL.
 */

import {
     S3Client,
     PutObjectCommand,
     DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function getS3Client() {
     const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
     const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
     const endpoint = process.env.R2_ENDPOINT ?? "";

  if (!accessKeyId || !secretAccessKey || !endpoint) {
         throw new Error(
                  "R2 storage credentials missing: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT"
                );
  }

  return new S3Client({
         region: "auto",
         endpoint,
         credentials: { accessKeyId, secretAccessKey },
         forcePathStyle: true,
  });
}

function getBucketName(): string {
     const bucket = process.env.R2_BUCKET_NAME ?? "";
     if (!bucket) throw new Error("R2_BUCKET_NAME environment variable is missing");
     return bucket;
}

function normalizeKey(relKey: string): string {
     return relKey.replace(/^\/+/, "");
}

function buildPublicUrl(key: string): string {
     const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? "";
     const endpoint = process.env.R2_ENDPOINT ?? "";
     const bucket = process.env.R2_BUCKET_NAME ?? "";

  if (publicBaseUrl) {
         return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  // Fallback: path-style URL
  return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
}

export async function storagePut(
     relKey: string,
     data: Buffer | Uint8Array | string,
     contentType = "application/octet-stream"
   ): Promise<{ key: string; url: string }> {
     const client = getS3Client();
     const bucket = getBucketName();
     const key = normalizeKey(relKey);

  const bodyBuffer =
         data instanceof Buffer
         ? data
           : data instanceof Uint8Array
         ? Buffer.from(data)
           : Buffer.from(data);

  const command = new PutObjectCommand({
         Bucket: bucket,
         Key: key,
         Body: bodyBuffer,
         ContentType: contentType,
  });

  const response = await client.send(command);

  if (
         response.$metadata.httpStatusCode &&
         response.$metadata.httpStatusCode >= 400
       ) {
         throw new Error(
                  `Storage upload failed with status ${response.$metadata.httpStatusCode}`
                );
  }

  return { key, url: buildPublicUrl(key) };
}

export async function storageGet(
     relKey: string
   ): Promise<{ key: string; url: string }> {
     const key = normalizeKey(relKey);
     return { key, url: buildPublicUrl(key) };
}

export async function storageDelete(relKey: string): Promise<void> {
     const client = getS3Client();
     const bucket = getBucketName();
     const key = normalizeKey(relKey);

  try {
         const command = new DeleteObjectCommand({
                  Bucket: bucket,
                  Key: key,
         });
         await client.send(command);
  } catch (err) {
         // Non-fatal: log but don't throw — cleanup is best-effort
       console.error(`[Storage] Failed to delete key "${key}":`, err);
  }
}
