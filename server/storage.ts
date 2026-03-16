import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type StorageConfig =
  | {
      provider: "r2";
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
    }
  | {
      provider: "forge";
      baseUrl: string;
      apiKey: string;
    };

let s3Client: S3Client | null = null;

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function getStorageConfig(): StorageConfig {
  const hasR2Credentials =
    !!ENV.r2BucketName &&
    !!ENV.r2AccessKeyId &&
    !!ENV.r2SecretAccessKey &&
    !!ENV.r2Endpoint;

  if (ENV.storageProvider === "r2") {
    if (!hasR2Credentials) {
      throw new Error(
        "R2 storage config is incomplete: set R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_ENDPOINT (or R2_ACCOUNT_ID)."
      );
    }

    return {
      provider: "r2",
      endpoint: stripTrailingSlashes(ENV.r2Endpoint),
      bucket: ENV.r2BucketName,
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
      publicBaseUrl: ENV.r2PublicBaseUrl ? stripTrailingSlashes(ENV.r2PublicBaseUrl) : undefined,
    };
  }

  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    if (hasR2Credentials) {
      return {
        provider: "r2",
        endpoint: stripTrailingSlashes(ENV.r2Endpoint),
        bucket: ENV.r2BucketName,
        accessKeyId: ENV.r2AccessKeyId,
        secretAccessKey: ENV.r2SecretAccessKey,
        publicBaseUrl: ENV.r2PublicBaseUrl ? stripTrailingSlashes(ENV.r2PublicBaseUrl) : undefined,
      };
    }

    throw new Error(
      "Storage config missing: provide R2_* env vars (recommended) or BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY."
    );
  }

  return { provider: "forge", baseUrl: stripTrailingSlashes(baseUrl), apiKey };
}

function getS3Client(config: Extract<StorageConfig, { provider: "r2" }>): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildForgeDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function toFormData(data: Buffer | Uint8Array | string, contentType: string, fileName: string): FormData {
  const blob =
    typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function buildR2DownloadUrl(
  config: Extract<StorageConfig, { provider: "r2" }>,
  key: string
): Promise<string> {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${key}`;
  }

  const client = getS3Client(config);
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
    { expiresIn: 60 * 60 }
  );
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  if (config.provider === "r2") {
    const client = getS3Client(config);
    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    return {
      key,
      url: await buildR2DownloadUrl(config, key),
    };
  }

  const uploadUrl = buildUploadUrl(config.baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(config.apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
  }

  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  if (config.provider === "r2") {
    return {
      key,
      url: await buildR2DownloadUrl(config, key),
    };
  }

  return {
    key,
    url: await buildForgeDownloadUrl(config.baseUrl, key, config.apiKey),
  };
}

export async function storageDelete(relKey: string): Promise<void> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  try {
    if (config.provider === "r2") {
      const client = getS3Client(config);
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        })
      );
      return;
    }

    const deleteUrl = new URL("v1/storage/delete", ensureTrailingSlash(config.baseUrl));
    deleteUrl.searchParams.set("path", key);
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: buildAuthHeaders(config.apiKey),
    });
  } catch (err) {
    console.error(`[Storage] Failed to delete key "${key}":`, err);
  }
}
