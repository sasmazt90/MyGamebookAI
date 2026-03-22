/**
 * Image generation helper.
 *
 * Supports:
 * - Google Gemini image generation (`IMAGE_PROVIDER=google`)
 * - Legacy Forge ImageService (`IMAGE_PROVIDER=forge`)
 */
import { storagePut } from "server/storage";
import sharp from "sharp";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  hardIdentity?: boolean;
  noText?: boolean;
};

export type GenerateImageResponse = {
  url?: string;
  mimeType?: string;
};

type GooglePart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

const MAX_REFERENCE_EDGE = 1536;
const WEBP_REFERENCE_QUALITY = 90;
const WEBP_OUTPUT_QUALITY = 86;
const GEMINI_IMAGE_TEMPERATURE = 1;
const GEMINI_IMAGE_TOP_P = 0.85;
const GEMINI_IMAGE_SIZE = "512";
const GEMINI_THINKING_LEVEL = "MINIMAL";

function fileExtensionForMimeType(mimeType?: string): string {
  switch ((mimeType || "").toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
      return "png";
    default:
      return "bin";
  }
}

async function optimizeReferenceBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith("image/")) {
    return { buffer, mimeType };
  }

  try {
    const pipeline = sharp(buffer, { failOn: "none" }).rotate();
    const metadata = await pipeline.metadata();
    const needsResize =
      (metadata.width ?? 0) > MAX_REFERENCE_EDGE ||
      (metadata.height ?? 0) > MAX_REFERENCE_EDGE;
    const resized = needsResize
      ? pipeline.resize({
          width: MAX_REFERENCE_EDGE,
          height: MAX_REFERENCE_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
      : pipeline;
    const optimizedBuffer = await resized
      .webp({ quality: WEBP_REFERENCE_QUALITY, effort: 4 })
      .toBuffer();

    return { buffer: optimizedBuffer, mimeType: "image/webp" };
  } catch (error) {
    console.warn(
      "[ImageGen] Reference optimization failed, using original image bytes:",
      error
    );
    return { buffer, mimeType };
  }
}

async function optimizeGeneratedBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith("image/")) {
    return { buffer, mimeType };
  }

  try {
    const optimizedBuffer = await sharp(buffer, { failOn: "none" })
      .rotate()
      .webp({ quality: WEBP_OUTPUT_QUALITY, effort: 4 })
      .toBuffer();

    return { buffer: optimizedBuffer, mimeType: "image/webp" };
  } catch (error) {
    console.warn(
      "[ImageGen] Output optimization failed, storing original image bytes:",
      error
    );
    return { buffer, mimeType };
  }
}

const withTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 120000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

async function toGoogleImagePart(image: {
  url?: string;
  b64Json?: string;
  mimeType?: string;
}): Promise<GooglePart | null> {
  if (image.b64Json) {
    const sourceMimeType = image.mimeType || "image/png";
    const { buffer, mimeType } = await optimizeReferenceBuffer(
      Buffer.from(image.b64Json, "base64"),
      sourceMimeType
    );
    return {
      inline_data: {
        mime_type: mimeType,
        data: buffer.toString("base64"),
      },
    };
  }

  if (!image.url) return null;

  const res = await withTimeout(image.url, {}, 30000);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch original image: ${res.status} ${res.statusText}`
    );
  }
  const mime =
    res.headers.get("content-type") || image.mimeType || "image/jpeg";
  const { buffer, mimeType } = await optimizeReferenceBuffer(
    Buffer.from(await res.arrayBuffer()),
    mime
  );

  return {
    inline_data: {
      mime_type: mimeType,
      data: buffer.toString("base64"),
    },
  };
}

async function generateWithGoogle(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.googleApiKey) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }

  const model = ENV.googleImageModel;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ENV.googleApiKey)}`;

  const originalParts = await Promise.all(
    (options.originalImages || []).map(toGoogleImagePart)
  );

  // Newer Gemini image models (2.5+, 3.x) only support responseModalities: ["IMAGE"]
  // Older models (2.0) used ["TEXT", "IMAGE"]
  const isNewerModel =
    /gemini-(2\.5|3[\.\d]*)-.*image/i.test(model) || /nano-banana/i.test(model);
  const isGemini31FlashImagePreview =
    /gemini-3\.1-flash-image-preview/i.test(model);

  const promptPrefix = [
    options.hardIdentity && (options.originalImages?.length ?? 0) > 0
      ? "HARD IDENTITY MODE: treat every provided reference image as a strict identity anchor. Preserve the exact same person and facial structure. Identity overrides style."
      : "",
    options.noText !== false
      ? "NO TEXT MODE: do not generate letters, words, numbers, symbols, captions, labels, logos, watermarks, user-interface elements, or overlays."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const effectivePrompt = promptPrefix
    ? `${promptPrefix}\n\n${options.prompt}`
    : options.prompt;

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: effectivePrompt }, ...originalParts.filter(Boolean)],
      },
    ],
    generationConfig: {
      responseModalities: isNewerModel ? ["IMAGE"] : ["TEXT", "IMAGE"],
      temperature: GEMINI_IMAGE_TEMPERATURE,
      topP: GEMINI_IMAGE_TOP_P,
      ...(isGemini31FlashImagePreview
        ? {
            thinkingConfig: {
              thinkingLevel: GEMINI_THINKING_LEVEL,
            },
            imageConfig: {
              imageSize: GEMINI_IMAGE_SIZE,
            },
          }
        : {}),
    },
  };

  console.log(
    `[ImageGen] Calling model=${model}, isNewerModel=${isNewerModel}, temperature=${GEMINI_IMAGE_TEMPERATURE}, topP=${GEMINI_IMAGE_TOP_P}, imageSize=${isGemini31FlashImagePreview ? GEMINI_IMAGE_SIZE : "default"}, thinkingLevel=${isGemini31FlashImagePreview ? GEMINI_THINKING_LEVEL : "default"}, promptPreview=${effectivePrompt.substring(0, 100)}...`
  );

  const response = await withTimeout(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText}): ${detail}`
    );
  }

  const result = (await response.json()) as any;

  // Debug: log the response structure to help diagnose issues
  const candidates = result?.candidates;
  if (!candidates || candidates.length === 0) {
    const blockReason = result?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(
        `Image generation blocked by safety filter: ${blockReason}`
      );
    }
    throw new Error(
      `Image generation returned no candidates. Response: ${JSON.stringify(result).substring(0, 500)}`
    );
  }

  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error(
      `Image generation returned empty parts. Candidate: ${JSON.stringify(candidates[0]).substring(0, 500)}`
    );
  }

  // Look for image data in all possible field name formats
  const imagePart = parts.find(
    (p: any) => p?.inlineData?.data || p?.inline_data?.data
  );

  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const mimeType =
    imagePart?.inlineData?.mimeType ||
    imagePart?.inline_data?.mime_type ||
    "image/png";

  if (!b64) {
    // Log what we actually got for debugging
    const partTypes = parts
      .map((p: any) => Object.keys(p).join(","))
      .join(" | ");
    throw new Error(
      `Image generation response did not include image data. Part types: [${partTypes}]. First part: ${JSON.stringify(parts[0]).substring(0, 300)}`
    );
  }

  const { buffer: uploadBuffer, mimeType: uploadMimeType } =
    await optimizeGeneratedBuffer(Buffer.from(b64, "base64"), mimeType);
  const { url } = await storagePut(
    `generated/${Date.now()}.${fileExtensionForMimeType(uploadMimeType)}`,
    uploadBuffer,
    uploadMimeType
  );

  console.log(`[ImageGen] Successfully generated image: ${url}`);
  return { url, mimeType: uploadMimeType };
}

async function generateWithForge(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const promptPrefix = [
    options.hardIdentity && (options.originalImages?.length ?? 0) > 0
      ? "HARD IDENTITY MODE: preserve the exact same person and facial structure from the reference images."
      : "",
    options.noText !== false
      ? "NO TEXT MODE: generate no letters, words, numbers, symbols, captions, or overlays."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const effectivePrompt = promptPrefix
    ? `${promptPrefix}\n\n${options.prompt}`
    : options.prompt;

  const response = await withTimeout(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: effectivePrompt,
      original_images: options.originalImages || [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };

  const { buffer: uploadBuffer, mimeType: uploadMimeType } =
    await optimizeGeneratedBuffer(
      Buffer.from(result.image.b64Json, "base64"),
      result.image.mimeType
    );
  const { url } = await storagePut(
    `generated/${Date.now()}.${fileExtensionForMimeType(uploadMimeType)}`,
    uploadBuffer,
    uploadMimeType
  );

  return { url, mimeType: uploadMimeType };
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (ENV.imageProvider === "forge") {
    return generateWithForge(options);
  }

  return generateWithGoogle(options);
}
