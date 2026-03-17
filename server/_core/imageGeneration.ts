/**
 * Image generation helper.
 *
 * Supports:
 * - Google Gemini image generation (`IMAGE_PROVIDER=google`)
 * - Legacy Forge ImageService (`IMAGE_PROVIDER=forge`)
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

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


const withTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 90000): Promise<Response> => {
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ENV.googleImageModel)}:generateContent?key=${encodeURIComponent(ENV.googleApiKey)}`;

  const originalParts = await Promise.all(
    (options.originalImages || []).map(toGoogleImagePart)
  );

  const payload = {
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
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

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
      `Google image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as any;
  const parts = result?.candidates?.[0]?.content?.parts;
  const imagePart = Array.isArray(parts)
    ? parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
    : null;

  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const mimeType =
    imagePart?.inlineData?.mimeType ||
    imagePart?.inline_data?.mime_type ||
    "image/png";

  if (!b64) {
    throw new Error("Google image generation response did not include image data");
  }

  const buffer = Buffer.from(b64, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    mimeType
  );

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
    image: {
      b64Json: string;
      mimeType: string;
    };
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
