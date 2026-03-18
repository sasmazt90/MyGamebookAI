/**
 * Image generation helper using Google Gemini API (imagen / gemini-2.0-flash-exp).
 * Falls back gracefully when API key is not configured.
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
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

export async function generateImage(
    options: GenerateImageOptions
  ): Promise<GenerateImageResponse> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const model = process.env.GOOGLE_IMAGE_MODEL ?? "imagen-3.0-generate-002";

  if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is not configured");
  }

  // Use Imagen 3 via Vertex-compatible REST endpoint (Gemini Developer API)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

  const body: Record<string, unknown> = {
        instances: [{ prompt: options.prompt }],
        parameters: {
                sampleCount: 1,
        },
  };

  const response = await fetch(url, {
        method: "POST",
        headers: {
                "Content-Type": "application/json",
                        "Referer": process.env.CORS_ORIGIN?.split(",")[0] ?? "https://my-gamebook-ai.vercel.app",
        },
        body: JSON.stringify(body),
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

  const prediction = result.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
          throw new Error("Image generation returned no image data");
    }

  const base64Data = prediction.bytesBase64Encoded;
    const mimeType = prediction.mimeType ?? "image/png";
    const buffer = Buffer.from(base64Data, "base64");

  // Save to R2 storage
  const { url: imageUrl } = await storagePut(
        `generated/${Date.now()}.png`,
        buffer,
        mimeType
      );

  return { url: imageUrl };
}
