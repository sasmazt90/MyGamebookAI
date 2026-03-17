/**
 * Storage helpers using Cloudflare R2 (S3-compatible API).
 * Uses environment variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_BASE_URL, R2_ACCOUNT_ID.
 */

function getR2Config() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    const bucketName = process.env.R2_BUCKET_NAME ?? "";
    const endpoint = process.env.R2_ENDPOINT ?? "";
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? "";

  if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
        throw new Error(
                "R2 storage credentials missing: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT"
              );
  }

  return { accessKeyId, secretAccessKey, bucketName, endpoint, publicBaseUrl };
}

function normalizeKey(relKey: string): string {
    return relKey.replace(/^\/+/, "");
}

/**
 * Create an AWS Signature V4 authorization header for R2/S3.
 * Lightweight implementation without external SDK dependencies.
 */
async function signS3Request(
    method: string,
    key: string,
    contentType: string,
    body: Buffer | string,
    config: ReturnType<typeof getR2Config>
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const { accessKeyId, secretAccessKey, bucketName, endpoint } = config;

  // Build URL
  const baseEndpoint = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    const url = `${baseEndpoint}/${bucketName}/${key}`;

  const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const bodyBuffer = typeof body === "string" ? Buffer.from(body) : body;

  // SHA-256 hash of body
  const hashBuffer = await crypto.subtle.digest("SHA-256", bodyBuffer);
    const payloadHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const host = new URL(url).host;

  const canonicalRequest = [
        method,
        `/${bucketName}/${key}`,
        "",
        `content-type:${contentType}\n`,
        `host:${host}\n`,
        `x-amz-content-sha256:${payloadHash}\n`,
        `x-amz-date:${amzDate}\n`,
        signedHeaders,
        payloadHash,
      ].join("\n");

  const region = "auto";
    const service = "s3";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalHashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalRequest)
      );
    const canonicalHash = Array.from(new Uint8Array(canonicalHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        canonicalHash,
      ].join("\n");

  // Signing key derivation
  async function hmacSHA256(key: BufferSource, data: string): Promise<ArrayBuffer> {
        const cryptoKey = await crypto.subtle.importKey(
                "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
              );
        return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  }

  const kDate = await hmacSHA256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmacSHA256(kDate, region);
    const kService = await hmacSHA256(kRegion, service);
    const kSigning = await hmacSHA256(kService, "aws4_request");
    const signatureBuffer = await hmacSHA256(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
        url,
        headers: {
                "Content-Type": contentType,
          "Host": host,
                "X-Amz-Content-Sha256": payloadHash,
                "X-Amz-Date": amzDate,
                "Authorization": authorization,
        },
  };
}

export async function storagePut(
    relKey: string,
    data: Buffer | Uint8Array | string,
    contentType = "application/octet-stream"
  ): Promise<{ key: string; url: string }> {
    const config = getR2Config();
    const key = normalizeKey(relKey);

  const bodyBuffer =
        data instanceof Buffer
        ? data
          : data instanceof Uint8Array
        ? Buffer.from(data)
          : Buffer.from(data);

  const { url, headers } = await signS3Request("PUT", key, contentType, bodyBuffer, config);

  const response = await fetch(url, {
        method: "PUT",
        headers,
        body: bodyBuffer,
  });

  if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(
                `Storage upload failed (${response.status} ${response.statusText}): ${message}`
              );
  }

  // Build public URL
  const publicUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`
        : url;

  return { key, url: publicUrl };
}

export async function storageGet(
    relKey: string
  ): Promise<{ key: string; url: string }> {
    const config = getR2Config();
    const key = normalizeKey(relKey);

  const publicUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`
        : `${config.endpoint.replace(/\/+$/, "")}/${config.bucketName}/${key}`;

  return { key, url: publicUrl };
}

export async function storageDelete(relKey: string): Promise<void> {
    const config = getR2Config();
    const key = normalizeKey(relKey);

  try {
        const emptyBuffer = Buffer.alloc(0);
        const { url, headers } = await signS3Request("DELETE", key, "application/octet-stream", emptyBuffer, config);

      await fetch(url, {
              method: "DELETE",
              headers,
      });
  } catch (err) {
        // Non-fatal: log but don't throw — cleanup is best-effort
      console.error(`[Storage] Failed to delete key "${key}":`, err);
  }
}
