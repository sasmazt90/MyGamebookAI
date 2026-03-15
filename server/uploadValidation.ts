/**
 * Upload validation helpers.
 *
 * Enforces allowed mime types and max file sizes at the server boundary
 * before any bytes are written to S3.
 */

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const MAX_SIZES = {
  /** Character photos: 5 MB */
  characterPhoto: 5 * 1024 * 1024,
  /** Banner images: 5 MB */
  banner: 5 * 1024 * 1024,
  /** Book cover images: 10 MB */
  cover: 10 * 1024 * 1024,
  /** Avatar images: 2 MB */
  avatar: 2 * 1024 * 1024,
} as const;

export type UploadKind = keyof typeof MAX_SIZES;

export interface UploadValidationError {
  code: "INVALID_MIME" | "FILE_TOO_LARGE";
  message: string;
}

/**
 * Validate a base64-encoded upload before writing to S3.
 * Returns null on success, or an error object on failure.
 */
export function validateUpload(
  base64Data: string,
  mimeType: string,
  kind: UploadKind
): UploadValidationError | null {
  // Mime type check
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
    return {
      code: "INVALID_MIME",
      message: `File type "${mimeType}" is not allowed. Only PNG, JPEG, and WebP images are accepted.`,
    };
  }

  // Size check — base64 encodes ~4/3 bytes, so byte length ≈ base64.length * 0.75
  const approxBytes = Math.ceil(base64Data.length * 0.75);
  const maxBytes = MAX_SIZES[kind];
  if (approxBytes > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      code: "FILE_TOO_LARGE",
      message: `File is too large. Maximum size for ${kind} is ${maxMB} MB.`,
    };
  }

  return null;
}

/**
 * Validate a raw Buffer upload (e.g. from multipart form).
 */
export function validateBufferUpload(
  buffer: Buffer,
  mimeType: string,
  kind: UploadKind
): UploadValidationError | null {
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
    return {
      code: "INVALID_MIME",
      message: `File type "${mimeType}" is not allowed. Only PNG, JPEG, and WebP images are accepted.`,
    };
  }

  const maxBytes = MAX_SIZES[kind];
  if (buffer.byteLength > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      code: "FILE_TOO_LARGE",
      message: `File is too large. Maximum size for ${kind} is ${maxMB} MB.`,
    };
  }

  return null;
}
