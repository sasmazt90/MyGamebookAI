/**
 * Image generation helper.
 *
 * Supports:
 * - Google Gemini image generation (`IMAGE_PROVIDER=google`)
 * - Legacy Forge ImageService (`IMAGE_PROVIDER=forge`)
 */

import { storagePut } from "server/storage";

export type GenerateImageOptions = {
    prompt: string;
    originalImages?: Array<{
      url?: string;
      b64Json?: string;
      mimeType?: string;
    }>;
};

export type GenerateImageResponse = {
    url?: string;
};

type GooglePart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };


const withTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 120000): Promise<Response> => {
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
    return {
      inline_data: {
        mime_type: image.mimeType || "image/png",
        data: image.b64Json,
      },
    };
  }

  if (!image.url) return null;

  const res = await withTimeout(image.url, {}, 30000);
  if (!res.ok) {
    throw new Error(`Failed to fetch original image: ${res.status} ${res.statusText}`);
  }
  const mime = res.headers.get("content-type") || image.mimeType || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());

  return {
    inline_data: {
      mime_type: mime,
      data: buffer.toString("base64"),
    },
  };
}

async function generateWithGoogle(options: GenerateImageOptions): Promise<GenerateImageResponse> {
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
  const isNewerModel = /gemini-(2\.5|3[\.\d]*)-.*image/i.test(model) ||
                       /nano-banana/i.test(model);

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [
          { text: options.prompt },
          ...originalParts.filter(Boolean),
        ],
      },
    ],
    generationConfig: {
      responseModalities: isNewerModel ? ["IMAGE"] : ["TEXT", "IMAGE"],
    },
  };

  console.log(`[ImageGen] Calling model=${model}, isNewerModel=${isNewerModel}, prompt=${options.prompt.substring(0, 100)}...`);

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
      throw new Error(`Image generation blocked by safety filter: ${blockReason}`);
    }
    throw new Error(`Image generation returned no candidates. Response: ${JSON.stringify(result).substring(0, 500)}`);
  }

  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error(`Image generation returned empty parts. Candidate: ${JSON.stringify(candidates[0]).substring(0, 500)}`);
  }

  // Look for image data in all possible field name formats
  const imagePart = parts.find((p: any) =>
    p?.inlineData?.data ||
    p?.inline_data?.data
  );

  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const mimeType =
    imagePart?.inlineData?.mimeType ||
    imagePart?.inline_data?.mime_type ||
    "image/png";

  if (!b64) {
    // Log what we actually got for debugging
    const partTypes = parts.map((p: any) => Object.keys(p).join(",")).join(" | ");
    throw new Error(`Image generation response did not include image data. Part types: [${partTypes}]. First part: ${JSON.stringify(parts[0]).substring(0, 300)}`);
  }

  const buffer = Buffer.from(b64, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    mimeType
  );

  console.log(`[ImageGen] Successfully generated image: ${url}`);
  return { url };
}

async function generateWithForge(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const response = await withTimeout(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
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
        predictions?: Array<{
                bytesBase64Encoded?: string;
                mimeType?: string;
        }>;
  };

  const buffer = Buffer.from(result.image.b64Json, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );

  return { url };
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (ENV.imageProvider === "forge") {
    return generateWithForge(options);
  }

  return generateWithGoogle(options);
}
