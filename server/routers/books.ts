import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  like,
  not,
  or,
  sql,
  sum,
  count,
  avg,
} from "drizzle-orm";
import { z } from "zod";
import {
  bookCharacters,
  bookPages,
  books,
  campaigns,
  generationJobs,
  profiles,
  userBooks,
  users,
  wallets,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { adjustCredits } from "./credits";
import { createNotification } from "./notifications";
import {
  dispatchLeaderboardNotifications,
  notifySalesMilestone,
} from "../notificationEvents";
import { invokeLLM } from "../_core/llm";
import { generateImage } from "../_core/imageGeneration";
import { storageDelete, storagePut } from "../storage";
import { refreshAuthorStats } from "../authorStatsCache";
import { nanoid } from "nanoid";
import { sanitizeText, sanitizeRichText } from "../sanitize";
import {
  branchSimilarityScore,
  buildScenePrompt,
  type CanonicalCharacterProfile as VisualCanonicalCharacterProfile,
  createBookVisualBlueprint,
  createCanonicalCharacterProfiles,
  getNoTextRule,
  parseSceneSpecResponse,
  sceneSpecFallback,
  selectReferenceImages,
  type RecurringObjectProfile,
  type SceneSpec,
} from "../bookContinuity";
import {
  buildFallbackStoryGraph,
  computeStoryGenerationTargets,
  validateStoryShape,
} from "../storyGraph";

async function imageUrlToBase64DataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

import { validateUpload } from "../uploadValidation";
import { claimAndRunJob } from "../generationWorker";
import {
  getBaseCost,
  photoExtraPerPhoto,
  computeTotalCost,
} from "../../shared/pricing";

/**
 * Attempts to repair malformed JSON from LLM output.
 * Handles: unterminated strings, trailing commas, truncated output,
 * unescaped control characters, and markdown code fences.
 */
function repairJSON(raw: string): string {
  let s = raw.trim();

  // Remove markdown code fences if present
  if (s.startsWith("```")) {
    s = s
      .replace(/^\`\`\`(?:json)?\n?/, "")
      .replace(/\n?\`\`\`$/, "")
      .trim();
  }

  // Try parsing as-is first before mutating valid JSON
  try {
    JSON.parse(s);
    return s;
  } catch (_) {}

  // Remove trailing commas before } or ] ONLY when outside strings
  const stripTrailingCommasOutsideStrings = (input: string): string => {
    let result = "";
    let inStr = false;
    let escape = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (escape) {
        result += ch;
        escape = false;
        continue;
      }

      if (ch === "\\") {
        result += ch;
        escape = true;
        continue;
      }

      if (ch === '"') {
        result += ch;
        inStr = !inStr;
        continue;
      }

      if (!inStr && ch === ",") {
        let j = i + 1;
        while (j < input.length && /\s/.test(input[j])) j++;

        if (j < input.length && (input[j] === "}" || input[j] === "]")) {
          continue;
        }
      }

      result += ch;
    }

    return result;
  };

  s = stripTrailingCommasOutsideStrings(s);

  // Try parsing again after safe trailing-comma cleanup
  try {
    JSON.parse(s);
    return s;
  } catch (_) {}

  // Fix unterminated strings
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && inStr) {
      i++;
      continue;
    }
    if (s[i] === '"') {
      inStr = !inStr;
    }
  }
  if (inStr) {
    s = s + '"';
  }

  // Close any unclosed brackets/braces
  const stack: string[] = [];
  inStr = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && inStr) {
      i++;
      continue;
    }
    if (s[i] === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (s[i] === "{") stack.push("}");
    else if (s[i] === "[") stack.push("]");
    else if (s[i] === "}" || s[i] === "]") stack.pop();
  }

  // Remove trailing commas at end
  s = s.replace(/,\s*$/m, "");

  // Close structures
  while (stack.length > 0) s += stack.pop();

  // Final safe cleanup (again outside strings)
  s = stripTrailingCommasOutsideStrings(s);

  return s;
}

function extractLikelyJsonObject(raw: string): string {
  const input = raw.trim();
  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return input.slice(firstBrace, lastBrace + 1);
  }
  return input;
}

function compactList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))
  );
}

function normaliseLanguageTag(language?: string): string {
  return (language ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
}

function getLocalizedChoiceFallbacks(language?: string) {
  switch (normaliseLanguageTag(language)) {
    case "tr":
      return {
        optionA: "Seçenek A",
        optionB: "Seçenek B",
        tryDifferent: "Başka bir yol dene",
        reconsider: "Durup başka bir yol düşün",
        proceed: "Planla devam et",
        faceDirectly: "Doğrudan yüzleş",
      };
    case "de":
      return {
        optionA: "Option A",
        optionB: "Option B",
        tryDifferent: "Versuche einen anderen Weg",
        reconsider: "Halte inne und versuche einen anderen Weg",
        proceed: "Folge dem Plan",
        faceDirectly: "Stelle dich dem direkt",
      };
    case "fr":
      return {
        optionA: "Option A",
        optionB: "Option B",
        tryDifferent: "Essaie une autre voie",
        reconsider: "Reflechis puis essaie une autre voie",
        proceed: "Poursuis le plan",
        faceDirectly: "Affronte-le directement",
      };
    case "es":
      return {
        optionA: "Opción A",
        optionB: "Opción B",
        tryDifferent: "Prueba otro camino",
        reconsider: "Replantéalo e intenta otro camino",
        proceed: "Sigue el plan",
        faceDirectly: "Enfréntalo directamente",
      };
    default:
      return {
        optionA: "Option A",
        optionB: "Option B",
        tryDifferent: "Try a different approach",
        reconsider: "Reconsider and try another way",
        proceed: "Proceed with the plan",
        faceDirectly: "Face it directly",
      };
  }
}

function translateGenericChoiceFallback(
  value: string | null | undefined,
  language: string | undefined,
  slot: "A" | "B"
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const localized = getLocalizedChoiceFallbacks(language);
  switch (trimmed.toLowerCase()) {
    case "option a":
      return slot === "A" ? localized.optionA : value;
    case "option b":
      return slot === "B" ? localized.optionB : value;
    case "take the bold option":
    case "take the bold path":
      return slot === "A" ? localized.proceed : value;
    case "take the cautious option":
    case "take the cautious path":
      return slot === "B" ? localized.tryDifferent : value;
    case "try a different approach":
      return localized.tryDifferent;
    case "reconsider and try another way":
      return localized.reconsider;
    case "proceed with the plan":
      return localized.proceed;
    case "face it directly":
      return localized.faceDirectly;
    default:
      return value;
  }
}
const CATEGORY_LENGTH_RULES: Record<string, ReadonlyArray<string>> = {
  fairy_tale: ["thin"],
  comic: ["thin", "normal"],
  crime_mystery: ["normal", "thick"],
  fantasy_scifi: ["normal", "thick"],
  romance: ["normal", "thick"],
  horror_thriller: ["normal", "thick"],
};

function isLengthAllowedForCategory(category: string, length: string): boolean {
  return (CATEGORY_LENGTH_RULES[category] ?? []).includes(length);
}

function stripInlineChoiceLabels(content: string): string {
  const cleanedLines = content
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/\s+Choice\s*A\s*:.*/i, "")
        .replace(/\s+Choice\s*B\s*:.*/i, "")
        .trimEnd()
    )
    .filter(line => !/^\s*make\s+your\s+choice\s*:?\s*$/i.test(line))
    .filter(
      line => !/^\s*(?:choice\s*[ab]|[ab])\s*[:\)]\s*(?:null\s*)?$/i.test(line)
    );

  return cleanedLines
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normaliseCharacterPhotoUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());

  if (url.hostname.includes("drive.google.com")) {
    const fromPath = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
    const fromQuery = url.searchParams.get("id") ?? undefined;
    const fileId = fromPath || fromQuery;
    if (fileId) {
      // Use Googleusercontent endpoint because preview links are HTML pages.
      return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
    }
  }

  return url.toString();
}

async function fetchCharacterPhotoFromUrl(
  rawUrl: string
): Promise<{ base64Data: string; mimeType: string }> {
  const safeUrl = normaliseCharacterPhotoUrl(rawUrl);
  const response = await fetch(safeUrl, {
    headers: {
      "User-Agent": "GamebookAI/1.0",
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Character photo URL could not be downloaded (${response.status})`,
    });
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  if (!mimeType.startsWith("image/")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Character photo URL must point to a valid image",
    });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const asBase64 = bytes.toString("base64");
  const err = validateUpload(asBase64, mimeType, "characterPhoto");
  if (err) {
    throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
  }

  return { base64Data: asBase64, mimeType };
}

export async function generateBookContent(
  bookId: number,
  bookData: {
    title: string;
    category: string;
    length: string;
    description: string;
    language: string;
    characters: Array<{ name: string; photoUrl?: string }>;
    uploadedKeys?: string[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable during book generation");

  try {
    const { category, length, title, description, language, characters } =
      bookData;
    const isLandscape = category === "comic"; // Comic is landscape; fairy tale and others are portrait
    const isComic = category === "comic";
    const isOtherGenre = [
      "crime_mystery",
      "fantasy_scifi",
      "romance",
      "horror_thriller",
    ].includes(category);

    //  Spec-compliant page and image counts
    // fairy_tale:        10 pages, 10 page illustrations + 1 cover = 11 total images
    // comic thin:        10 pages x 3 panels = 30 panel images + 1 cover = 31 total
    // comic normal:      18 pages x 3 panels = 54 panel images + 1 cover = 55 total
    // other normal:      80 pages, 8 branch images + 1 cover = 9 total
    // other thick:       120 pages, 12 branch images + 1 cover = 13 total
    const generationTargets = computeStoryGenerationTargets(category, length);
    const pageCount = generationTargets.readablePathLength;
    const branchCount = generationTargets.branchCount;
    const branchImageCount = generationTargets.branchImageCount;
    const graphPageCount = generationTargets.graphPageCount;

    const charNames = characters.map(c => c.name).join(", ");

    // Character photos for image consistency  passed as originalImages to every generateImage call
    const charPhotos = characters
      .filter(c => c.photoUrl)
      .map(c => ({ url: c.photoUrl!, mimeType: "image/jpeg" as const }));
    const photoRefByName = new Map(
      characters
        .filter(c => c.photoUrl)
        .map(c => [
          c.name,
          { url: c.photoUrl!, mimeType: "image/jpeg" as const },
        ])
    );

    //  Global Style Lock
    // Each genre gets a rich, multi-axis style descriptor assembled ONCE and
    // injected verbatim into every image prompt (cover, per-page, comic panels).
    // Axes: art medium · lighting direction · colour temperature · palette ·
    //       brush/line style · framing rule · negative constraints.
    // This is the primary mechanism for visual consistency across all illustrations.
    const STYLE_PRESETS: Record<string, string> = {
      fairy_tale: [
        "classic children's storybook illustration",
        "warm natural storybook lighting, cozy indoor/outdoor glow",
        "storybook palette: rich but gentle colours, clean contrast, child-friendly tones",
        "clean gouache-style painted textures with crisp storybook outlines",
        "storybook composition, readable character silhouettes, expressive faces",
        "no text, no letters, no words, no captions",
      ].join(", "),
      comic: [
        "classic American comic book illustration",
        "strong directional side-lighting, high contrast",
        "vibrant saturated palette: primary reds, blues, yellows with halftone dot texture",
        "bold 2-3px black ink outlines, flat cel-shading, no gradients",
        "dynamic three-quarter angle framing, action-oriented composition",
        "no text, no letters, no speech bubbles in the base image",
      ].join(", "),
      crime_mystery: [
        "dark cinematic graphic-novel illustration",
        "dramatic chiaroscuro side-lighting, cool blue shadows, warm amber highlights",
        "desaturated noir palette: deep charcoal, slate, amber, teal accent",
        "precise ink-wash brushwork with fine cross-hatching in shadows",
        "low-angle or eye-level framing, tight medium shot, atmospheric depth",
        "no text, no letters, no words",
      ].join(", "),
      fantasy_scifi: [
        "epic cinematic digital painting",
        "dramatic rim-lighting from behind, cool blue-white key light, warm fill",
        "jewel-tone palette: deep sapphire, emerald, gold, violet with luminous glow effects",
        "detailed painterly brushwork, sharp focal character, soft background bokeh",
        "wide establishing shot or heroic three-quarter medium shot",
        "no text, no letters, no words",
      ].join(", "),
      romance: [
        "warm painterly illustration",
        "soft golden-hour back-lighting, warm 5500K colour temperature, gentle lens flare",
        "warm palette: honey gold, rose, peach, ivory with impressionistic bokeh",
        "loose impressionistic brushwork, soft edges, visible paint texture",
        "intimate medium-close framing, shallow depth of field",
        "no text, no letters, no words",
      ].join(", "),
      horror_thriller: [
        "dark atmospheric illustration",
        "harsh under-lighting or single harsh side-light, deep shadows, 2700K cool-teal ambient",
        "desaturated palette: near-black, ash grey, blood-red accent, sickly green tint",
        "scratchy textured brushwork, heavy vignette, grain overlay",
        "slightly low-angle framing to increase menace, tight crop",
        "no text, no letters, no words",
      ].join(", "),
    };
    const stylePreset =
      STYLE_PRESETS[category] ||
      "cinematic digital illustration, consistent character design, no text, no letters";
    type GlobalStyleProfile = {
      medium: string;
      lighting: string;
      palette: string;
      linework: string;
      composition: string;
      renderingRules: string[];
      continuityRules: string[];
    };
    const globalStyleProfile: GlobalStyleProfile = (() => {
      const byCategory: Record<string, GlobalStyleProfile> = {
        fairy_tale: {
          medium: "classic children's storybook gouache illustration",
          lighting: "warm natural storybook lighting with cozy gentle glow",
          palette: "rich but gentle child-friendly palette with clean contrast",
          linework: "crisp storybook outlines with soft painted texture",
          composition:
            "readable full-page storybook composition with expressive silhouettes",
          renderingRules: [
            "preserve one stable illustrated storybook finish from cover through final page",
            "favour clarity of action over abstract magical atmosphere",
            "keep backgrounds supportive, not noisy or textural clutter",
          ],
          continuityRules: [
            "do not drift into realism, anime, 3D, sketch, collage, or photobash",
            "maintain the same brush texture, colour handling, and edge treatment on every page",
          ],
        },
        comic: {
          medium: "classic American comic illustration",
          lighting: "strong directional side-lighting with graphic contrast",
          palette: "vibrant saturated comic palette with controlled primaries",
          linework:
            "bold black ink outlines with flat cel shading and halftone accents",
          composition:
            "dynamic action-forward framing with readable character staging",
          renderingRules: [
            "keep comic rendering uniform across all panels and pages",
            "prioritise readable action beats and panel clarity",
            "avoid painterly softness or drifting into generic fantasy art",
          ],
          continuityRules: [
            "maintain the same outline thickness, halftone treatment, and colour finish everywhere",
            "do not vary character design language between panels",
          ],
        },
        crime_mystery: {
          medium: "dark cinematic graphic-novel illustration",
          lighting:
            "dramatic chiaroscuro with cool shadows and warm highlights",
          palette:
            "desaturated noir palette with charcoal, slate, amber, and teal accents",
          linework: "precise ink-wash detailing with fine cross-hatching",
          composition: "tight atmospheric framing with strong focal character",
          renderingRules: [
            "keep the same noir graphic-novel treatment across the book",
            "make scene evidence and actions visually legible",
          ],
          continuityRules: [
            "avoid switching to bright fantasy palettes or soft children's-book rendering",
          ],
        },
        fantasy_scifi: {
          medium: "epic cinematic digital painting",
          lighting: "dramatic rim-lighting with cool key light and warm fill",
          palette: "jewel-tone palette with luminous accents",
          linework: "detailed painterly rendering with sharp focal forms",
          composition:
            "heroic wide or three-quarter framing with clear action read",
          renderingRules: [
            "keep one stable cinematic illustrated finish through the whole book",
            "show the exact story action, not just generic wonder imagery",
          ],
          continuityRules: [
            "do not mutate technology, costumes, or props between pages",
          ],
        },
        romance: {
          medium: "warm painterly illustration",
          lighting: "soft golden-hour back-lighting with gentle glow",
          palette: "warm honey, rose, peach, and ivory palette",
          linework: "soft painterly edges with visible paint texture",
          composition:
            "intimate medium-close framing with emotional readability",
          renderingRules: [
            "keep emotional clarity and stable painterly finish on every page",
          ],
          continuityRules: [
            "avoid style drift into comic, 3D, or generic fantasy rendering",
          ],
        },
        horror_thriller: {
          medium: "dark atmospheric illustration",
          lighting: "harsh directional light with deep shadow contrast",
          palette:
            "desaturated near-black palette with sickly green and blood-red accents",
          linework: "scratchy textured brushwork with heavy vignette",
          composition: "tight ominous framing with clear threat focus",
          renderingRules: [
            "keep the same oppressive visual language from page to page",
            "preserve object and character readability despite darkness",
          ],
          continuityRules: [
            "avoid accidental bright cheerful palettes or softened rendering",
          ],
        },
      };
      return (
        byCategory[category] ?? {
          medium: "cinematic illustrated storybook rendering",
          lighting: "consistent directed illustration lighting",
          palette: "controlled cohesive colour palette",
          linework: "consistent clean illustrative line and texture handling",
          composition: "readable action-first composition",
          renderingRules: [
            "preserve a single stable illustration finish across the full book",
          ],
          continuityRules: ["do not drift styles or redesign characters"],
        }
      );
    })();

    //  Step 1: Generate rich character cards
    // Each character gets a detailed visual + personality anchor used in every
    // subsequent LLM call to maintain consistency.
    await db
      .update(books)
      .set({ generationStep: "Building character profiles…" })
      .where(eq(books.id, bookId));
    type CharacterCard = {
      name: string;
      appearance: string; // physical description for image prompts
      voice: string; // speech style / personality for narrative
      role: string; // protagonist / antagonist / supporting
      photoUrl?: string;
      canonicalProfile?: VisualCanonicalCharacterProfile;
    };

    let characterCards: CharacterCard[] = [];

    //  Step 1a: Photo analysis pass
    // For every character that has an uploaded photo, use the multimodal LLM to
    // extract concrete visual descriptors across ALL 8 physical identity axes:
    //   1. skin_tone       complexion, undertone, texture
    //   2. face_shape      overall shape, jaw, chin, cheekbones
    //   3. hair_colour     primary + secondary colour, highlights
    //   4. hair_style      length, texture, cut style
    //   5. eye_colour      iris colour + any ring/fleck detail
    //   6. eye_shape       shape, size, lid type, lash density
    //   7. nose_shape      bridge, tip, width, profile
    //   8. eyebrows        thickness, arch, colour, spacing
    //   9. body_shape      height estimate, build, posture
    //  10. facial_hair     present/absent, style, colour
    //  11. distinctive     scars, freckles, moles, glasses, tattoos
    // The structured JSON output is used both to build the character card
    // appearance field and to populate the per-axis PHYSICAL_IDENTITY_LOCK.
    type PhotoAnalysis = {
      skin_tone: string;
      face_shape: string;
      hair_colour: string;
      hair_style: string;
      eye_colour: string;
      eye_shape: string;
      nose_shape: string;
      eyebrows: string;
      body_shape: string;
      facial_hair: string;
      distinctive: string;
      outfit_summary?: string;
      accessories?: string;
      headwear?: string;
      age_band?: string;
      age_detail?: string;
      prose_summary: string; // 2-3 sentence flowing description for the card
    };
    const photoAnalyses: Record<string, PhotoAnalysis> = {};
    const photoDescriptions: Record<string, string> = {}; // kept for backward compat
    for (const char of characters) {
      if (!char.photoUrl) continue;
      try {
        let photoDataUrl: string;
        try {
          photoDataUrl = await imageUrlToBase64DataUrl(char.photoUrl);
        } catch (dlErr) {
          console.warn(
            `[Books] Could not download photo for "${char.name}", skipping photo analysis:`,
            dlErr
          );
          continue;
        }
        const photoResp = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content:
                "You are a forensic character artist. Analyse photos with clinical precision for use as illustration references. Always respond with valid JSON only.",
            },
            {
              role: "user" as const,
              content: [
                {
                  type: "image_url" as const,
                  image_url: { url: photoDataUrl, detail: "high" as const },
                },
                {
                  type: "text" as const,
                  text: `Analyse this photo and return a JSON object with EXACTLY these keys describing the person's physical appearance:

{
  "skin_tone": "<e.g. fair porcelain, warm olive, medium tan, rich brown, deep ebony  include undertone: warm/cool/neutral>",
  "face_shape": "<e.g. oval with soft jaw, square with strong angular jaw, heart-shaped with wide forehead and pointed chin, round with full cheeks>",
  "hair_colour": "<primary colour + any secondary/highlight, e.g. dark espresso brown with subtle warm highlights>",
  "hair_style": "<length + texture + cut, e.g. short side-parted undercut, shoulder-length wavy bob, long straight with blunt fringe>",
  "eye_colour": "<iris colour + any ring or fleck, e.g. warm brown with amber ring, deep blue with grey flecks>",
  "eye_shape": "<e.g. almond-shaped medium eyes with double eyelid, round wide-set eyes with heavy upper lids, hooded deep-set eyes>",
  "nose_shape": "<e.g. straight medium bridge with rounded tip, broad flat bridge with wide nostrils, aquiline with high bridge and narrow tip>",
  "eyebrows": "<thickness + arch + colour, e.g. thick straight dark-brown brows, thin highly-arched light-brown brows, bushy natural brows with slight arch>",
  "body_shape": "<height estimate + build, e.g. tall athletic build with broad shoulders, medium height stocky muscular frame, petite slim build>",
  "facial_hair": "<e.g. clean-shaven, short dark stubble, full neatly-trimmed brown beard, thin moustache  or 'none' if absent>",
  "distinctive": "<any notable features: freckles, moles, scars, dimples, glasses, tattoos  or 'none'>",
  "outfit_summary": "<specific current outfit from the photo: garments, colours, shoes, and overall silhouette>",
  "accessories": "<visible accessories such as necklace, watch, bracelet, backpack, glasses  or 'none'>",
  "headwear": "<hat, hood, hair bow, hair clip, crown, helmet  or 'none'>",
  "age_band": "<child, teen, young adult, adult, middle-aged adult, older adult>",
  "age_detail": "<short age/maturity note, e.g. around seven years old, visibly teenage, early thirties adult>",
  "prose_summary": "<2-3 flowing sentences combining all the above into a natural character description suitable for an illustrated book>"
}

Be specific and concrete. Do NOT include the person's name, emotions, or story context. Only physical appearance.`,
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: pageCount >= 80 ? 32000 : pageCount >= 18 ? 14000 : 8000,
        });
        const raw = photoResp.choices[0]?.message?.content;
        if (typeof raw === "string" && raw.trim().length > 10) {
          try {
            const parsed = JSON.parse(repairJSON(raw)) as PhotoAnalysis;
            photoAnalyses[char.name] = parsed;
            // prose_summary is the backward-compat description used in card generation
            photoDescriptions[char.name] = parsed.prose_summary || raw.trim();
            console.log(
              `[Books] Photo analysis for "${char.name}": ${photoDescriptions[char.name].substring(0, 120)}¦`
            );
          } catch {
            // JSON parse failed  fall back to raw text
            photoDescriptions[char.name] = raw.trim();
            console.warn(
              `[Books] Photo analysis JSON parse failed for "${char.name}", using raw text.`
            );
          }
        }
      } catch (photoErr) {
        console.warn(
          `[Books] Photo analysis failed for "${char.name}", falling back to text-only appearance:`,
          photoErr
        );
      }
    }

    if (characters.length > 0) {
      try {
        // Build a rich per-character photo hint block using the structured analysis.
        // For each character with a photo, we inject ALL 11 axes so the card LLM
        // can produce a structured, axis-complete appearance sentence.
        const buildPhotoHintBlock = () => {
          const hints = characters
            .filter(c => photoAnalyses[c.name] || photoDescriptions[c.name])
            .map(c => {
              const a = photoAnalyses[c.name];
              if (a) {
                return `${c.name} (from reference photo):
  Skin tone: ${a.skin_tone}
  Face shape: ${a.face_shape}
  Hair colour: ${a.hair_colour}
  Hair style: ${a.hair_style}
  Eye colour: ${a.eye_colour}
  Eye shape: ${a.eye_shape}
  Nose shape: ${a.nose_shape}
  Eyebrows: ${a.eyebrows}
  Body shape: ${a.body_shape}
  Facial hair: ${a.facial_hair}
  Distinctive features: ${a.distinctive}
  Outfit: ${a.outfit_summary || "not specified"}
  Accessories: ${a.accessories || "none"}
  Headwear: ${a.headwear || "none"}
  Prose summary: ${a.prose_summary}`;
              }
              return `${c.name}: ${photoDescriptions[c.name]}`;
            })
            .join("\n\n");
          return hints
            ? `\n\nREFERENCE PHOTO ANALYSES (you MUST base the appearance field on these  preserve every detail exactly):\n${hints}`
            : "";
        };
        const photoHintBlock = buildPhotoHintBlock();

        const cardResp = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content:
                "You are a character designer for interactive fiction. You produce detailed, axis-structured character cards for use as illustration references. Always respond with valid JSON only.",
            },
            {
              role: "user" as const,
              content: `Create detailed character cards for a ${category.replace(/_/g, " ")} gamebook titled "${title}".
Description: ${description}
Characters: ${characters.map(c => c.name).join(", ")}${photoHintBlock}

For each character provide:
- name: exact name as given
- appearance: A STRUCTURED description that MUST include one explicit sentence for EACH of the following axes. If a reference photo analysis is provided above, you MUST use those exact values:
    0. AGE: explicit age band and physical maturity, and this age MUST stay identical across all pages
    1. SKIN: skin tone and undertone (e.g. "warm olive skin with neutral undertone")
    2. FACE: face shape, jaw, and chin (e.g. "oval face with soft jaw and rounded chin")
    3. HAIR COLOUR: primary hair colour with any highlights (e.g. "dark espresso-brown hair with subtle warm highlights")
    4. HAIR STYLE: hair length, texture, and cut (e.g. "short side-parted undercut, slightly wavy")
    5. EYES COLOUR: eye colour with any ring or fleck detail (e.g. "warm brown eyes with amber ring")
    6. EYES SHAPE: eye shape, size, and lid type (e.g. "almond-shaped medium eyes with double eyelid and thick lashes")
    7. NOSE: nose bridge, tip, and width (e.g. "straight medium bridge with rounded tip")
    8. EYEBROWS: eyebrow thickness, arch, and colour (e.g. "thick straight dark-brown brows")
    9. BODY: height and build (e.g. "tall athletic build with broad shoulders")
   10. FACIAL HAIR: facial hair or 'clean-shaven' (e.g. "short dark stubble" or "clean-shaven")
   11. DISTINCTIVE: any notable features or 'none' (e.g. "small scar above left eyebrow")
   12. CLOTHING: describe the character's SPECIFIC outfit in detail (colours, style, accessories). This exact outfit MUST remain IDENTICAL across every single page  no outfit changes allowed
- voice: 1-2 sentences describing how they speak and their personality
- role: one of protagonist, antagonist, supporting

Respond with JSON: {"characters": [{"name": "", "appearance": "", "voice": "", "role": ""}]}

IMPORTANT: The appearance field must be a single string containing all 13 axes above, each on its own sentence. This will be used verbatim in image generation prompts.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: pageCount >= 80 ? 32000 : pageCount >= 18 ? 14000 : 8000,
        });
        const raw = cardResp.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(
          repairJSON(typeof raw === "string" ? raw : JSON.stringify(raw))
        );
        if (Array.isArray(parsed.characters)) {
          characterCards = parsed.characters.map(
            (c: CharacterCard, i: number) => ({
              ...c,
              // For characters with photo analyses, prepend the structured prose_summary
              // as the very first sentence so the most precise visual anchor leads.
              // The card LLM's axis-structured sentences follow immediately after.
              appearance: photoAnalyses[c.name]?.prose_summary
                ? `${photoAnalyses[c.name].prose_summary} ${c.appearance}`
                : photoDescriptions[c.name]
                  ? `${photoDescriptions[c.name]} ${c.appearance}`
                  : c.appearance,
              photoUrl: characters[i]?.photoUrl,
            })
          );
        }
      } catch (e) {
        console.error(
          "[Books] Character card generation failed, using names only:",
          e
        );
        characterCards = characters.map(c => ({
          name: c.name,
          appearance: photoAnalyses[c.name]?.prose_summary
            ? photoAnalyses[c.name].prose_summary
            : photoDescriptions[c.name]
              ? photoDescriptions[c.name]
              : `${c.name} is a key character in this story.`,
          voice: "Speaks clearly and consistently throughout the story.",
          role: "protagonist",
          photoUrl: c.photoUrl,
        }));
      }
    }

    const canonicalCharacterProfiles = createCanonicalCharacterProfiles(
      characterCards,
      photoAnalyses
    );

    // Build character card block for injection into every LLM call
    const characterCardBlock =
      characterCards.length > 0
        ? `\n\nCHARACTER CARDS (maintain these descriptions exactly throughout the story):\n${characterCards
            .map(
              c =>
                `- ${c.name} (${c.role}): ${c.appearance} Voice/personality: ${c.voice}`
            )
            .join("\n")}`
        : "";

    //  Character Anchor Block for image prompts
    // Uses the FULL appearance description (not just the first sentence) so the
    // image model receives every visual detail: hair, eyes, build, clothing,
    // distinguishing features. Assembled ONCE and injected into every image prompt.
    // Build a photo-reference note for the image prompt  lists which characters
    // have uploaded reference photos so the image model knows to use them as
    // face/identity anchors, not just style references.
    const photoRefNote = characterCards
      .filter(c => c.photoUrl)
      .map(c => c.name)
      .join(", ");
    // Build a STRUCTURED_IDENTITY_BLOCK from the raw PhotoAnalysis JSON for each character
    // that has an uploaded photo. This block is injected verbatim into every image prompt
    // so the image model receives the most precise possible face/body description.
    // Each axis is listed on its own line so the model cannot miss any trait.
    const buildStructuredIdentityBlock = (): string => {
      const blocks = characterCards
        .filter(c => c.photoUrl && photoAnalyses[c.name])
        .map(c => {
          const a = photoAnalyses[c.name];
          return [
            `=== PORTRAIT REFERENCE: ${c.name} (render this character's face and body EXACTLY as described) ===`,
            `Skin tone: ${a.skin_tone}`,
            `Face shape: ${a.face_shape}`,
            `Hair colour: ${a.hair_colour}`,
            `Hair style: ${a.hair_style}`,
            `Eye colour: ${a.eye_colour}`,
            `Eye shape: ${a.eye_shape}`,
            `Nose shape: ${a.nose_shape}`,
            `Eyebrows: ${a.eyebrows}`,
            `Body: ${a.body_shape}`,
            `Facial hair: ${a.facial_hair}`,
            `Distinctive features: ${a.distinctive}`,
            `Outfit: ${a.outfit_summary || "not specified"}`,
            `Accessories: ${a.accessories || "none"}`,
            `Headwear: ${a.headwear || "none"}`,
            `INSTRUCTION: Prioritise facial accuracy above all else. The face must be recognisable as this specific person. Do NOT genericise, idealise, or alter any facial feature.`,
          ].join("\n");
        });
      return blocks.length > 0 ? blocks.join("\n\n") : "";
    };
    const STRUCTURED_IDENTITY_BLOCK = buildStructuredIdentityBlock();
    const photoAnchorInstruction = STRUCTURED_IDENTITY_BLOCK
      ? `PHOTO-BASED CHARACTER REFERENCE:\n${STRUCTURED_IDENTITY_BLOCK}`
      : "";
    const formatCanonicalProfile = (
      profile: VisualCanonicalCharacterProfile
    ): string =>
      [
        `${profile.name} (${profile.role})`,
        `Appearance: ${profile.appearance}`,
        `Age lock: ${profile.ageLock}`,
        `Clothing lock: ${profile.clothingLock}`,
        profile.identityLock,
      ].join(" | ");
    const formatCompactCanonicalProfile = (
      profile: VisualCanonicalCharacterProfile,
      distinctMarker = ""
    ): string =>
      [
        `${profile.name} (${profile.role})`,
        `appearance ${profile.appearance}`,
        `age ${profile.ageLock}`,
        `clothing ${profile.clothingLock}`,
        profile.identityLock,
      ].join(", ") + distinctMarker;

    const canonicalCharacterLayer =
      canonicalCharacterProfiles.length > 0
        ? [
            "CANONICAL CHARACTER PROFILES (reuse these unchanged on every illustrated page):",
            ...canonicalCharacterProfiles.map(formatCanonicalProfile),
            photoAnchorInstruction,
          ]
            .filter(Boolean)
            .join("\n")
        : characters.length > 0
          ? `CHARACTERS (use reference photos for consistent appearance): ${charNames}`
          : "";

    const charAnchorBlock = canonicalCharacterLayer;

    // Fix 1: charVisualAnchor previously truncated appearance to the first sentence only
    // via .split(".")[0]  silently dropping hair colour, eye colour, and clothing from
    // comic panel prompts. Now uses the FULL appearance string, same as charAnchorBlock.
    const charVisualAnchor =
      canonicalCharacterProfiles.length > 0
        ? `CHARACTERS (exact appearance, every panel): ${canonicalCharacterProfiles.map(c => formatCompactCanonicalProfile(c)).join(" | ")}. Maintain exact character appearance in every panel.`
        : characters.length > 0
          ? `Characters: ${charNames}. Maintain exact character appearance.`
          : "";

    // Fix 3 + Regex Expansion: Build a CHARACTER_COLOUR_LOCK by extracting explicit hair
    // and eye colour keywords from each character's appearance field. The regex vocabulary
    // is intentionally broad so that LLM-generated appearance strings (which often use
    // evocative food/nature metaphors like "espresso", "honey", "ocean-blue") are captured
    // reliably. Matched phrases are repeated verbatim in every image prompt so the model
    // has a concrete colour anchor that survives style-preset competition.
    //
    // Hair colour adjective vocabulary (prefix group before "hair"):
    //   Basic:       black, brown, blonde/blond, brunette, red, orange, yellow, white, grey/gray
    //   Modifiers:   dark, light, medium, deep, pale, warm, cool, rich, bright, vivid
    //   Shades:      jet, ebony, charcoal, raven, sable (dark blacks)
    //                espresso, coffee, chocolate, mocha, mahogany, walnut, chestnut,
    //                toffee, caramel, cinnamon, hazel, warm-brown, ash-brown (browns)
    //                golden, honey, amber, caramel, tawny, sandy, wheat, flaxen,
    //                strawberry-blonde, dirty-blonde, platinum-blonde (blondes)
    //                auburn, copper, rust, ginger, flame, fiery (reds/coppers)
    //                silver, platinum, ash, salt-and-pepper, snow-white (silvers/whites)
    //                lavender, violet, indigo, teal, turquoise, blue, green, pink (fantasy)
    //
    // Eye colour adjective vocabulary (prefix group before "eyes"):
    //   Basic:       brown, blue, green, grey/gray, black, hazel, amber, violet, teal
    //   Modifiers:   dark, light, deep, bright, pale, warm, cool, rich
    //   Shades:      chocolate, espresso, coffee, honey (browns)
    //                steel, slate, silver, ash, stormy (greys)
    //                ice, sky, ocean, sapphire, cobalt, navy, cornflower (blues)
    //                emerald, jade, forest, olive, sage, moss (greens)
    //                golden, topaz, whiskey, cognac (ambers)
    //                compound: blue-grey, grey-green, grey-blue, green-hazel, etc.

    // Shared prefix group used in both hair and eye patterns
    const COLOUR_PREFIX =
      // Modifiers
      "(?:(?:dark|light|medium|deep|pale|warm|cool|rich|bright|vivid|soft|muted|natural|neutral|" +
      // Compound modifiers
      "salt-and-pepper|salt and pepper|dirty|strawberry|platinum|ash|jet|snow|" +
      // Food/nature descriptors (common in LLM output)
      "espresso|coffee|chocolate|mocha|mahogany|walnut|chestnut|toffee|caramel|cinnamon|" +
      "honey|amber|tawny|sandy|wheat|flaxen|golden|auburn|copper|rust|ginger|flame|fiery|" +
      "raven|ebony|charcoal|sable|silver|lavender|ocean|sapphire|cobalt|emerald|jade|" +
      "olive|steel|slate|stormy|ice|sky|topaz|whiskey|cognac|hazel|" +
      // Basic colours
      "black|brown|blonde|blond|brunette|red|orange|yellow|white|grey|gray|blue|green|" +
      "purple|pink|teal|violet|indigo|turquoise|coral|rose|burgundy|maroon|crimson|" +
      "scarlet|magenta|cyan|lime|navy|beige|ivory|cream|tan|nude|nude|" +
      // Compound colour-colour (e.g. "blue-grey", "grey-green")
      "blue-grey|grey-blue|grey-green|green-hazel|warm-brown|ash-brown|reddish-brown|" +
      "dark-brown|light-brown" +
      ")[\\s-]+)?";

    const colourKeywords = canonicalCharacterProfiles
      .map(c => {
        const app = [
          c.appearance,
          c.ageLock,
          c.clothingLock,
          c.identityLock,
        ].join(". ");

        //  Hair colour
        // Pattern: <optional multi-word colour prefix> + <core colour word> + optional
        // filler words + "hair" + optional trailing descriptor (e.g. "hair styled in waves")
        // We allow up to ~40 chars of filler between the colour word and "hair" to catch
        // constructions like "dark espresso-brown, slightly wavy hair".
        const HAIR_CORE =
          "(?:black|brown|blonde|blond|brunette|red|orange|yellow|white|grey|gray|" +
          "espresso|coffee|chocolate|mocha|mahogany|walnut|chestnut|toffee|caramel|" +
          "cinnamon|honey|amber|tawny|sandy|wheat|flaxen|golden|auburn|copper|rust|" +
          "ginger|flame|fiery|raven|ebony|charcoal|sable|silver|platinum|lavender|" +
          "blue|green|purple|pink|teal|violet|indigo|turquoise|burgundy|crimson)";
        const hairRe = new RegExp(
          `(${COLOUR_PREFIX}${HAIR_CORE}[\\w\\s,'-]{0,40}hair(?:[\\w\\s,'-]{0,30})?)`,
          "i"
        );
        const hairMatch = app.match(hairRe);

        //  Eye colour
        // Pattern: <optional multi-word colour prefix> + <core colour word> +
        //          optional single bridging colour word + "eyes"
        // The bridging word handles compound descriptors like "forest green eyes"
        // where "forest" is the evocative modifier and "green" is the base colour.
        // We allow one optional [\w-]+ word between the core colour and "eyes" so
        // both "emerald eyes" and "forest green eyes" are captured in full.
        const EYE_CORE =
          "(?:brown|blue|green|grey|gray|hazel|amber|black|violet|teal|" +
          "chocolate|espresso|coffee|honey|steel|slate|silver|ash|stormy|" +
          "ice|sky|ocean|sapphire|cobalt|navy|cornflower|emerald|jade|forest|" +
          "olive|sage|moss|golden|topaz|whiskey|cognac|blue-grey|grey-green|" +
          "grey-blue|green-hazel)";
        const eyeRe = new RegExp(
          `(${COLOUR_PREFIX}${EYE_CORE}(?:[\\s-]+[\\w-]+)?[\\s-]*eyes)`,
          "i"
        );
        const eyeMatch = app.match(eyeRe);

        //  3. SKIN TONE
        // Captures: "warm olive skin", "fair porcelain complexion", "deep ebony skin",
        // "medium tan skin with warm undertone", "rich brown skin", etc.
        const SKIN_TONE_WORDS =
          "(?:fair|pale|light|medium|tan|warm|cool|neutral|olive|golden|honey|caramel|" +
          "tawny|bronze|copper|brown|dark|deep|rich|ebony|mahogany|chocolate|mocha|" +
          "porcelain|ivory|peach|rose|ruddy|sallow|ashen|freckled)";
        const skinRe = new RegExp(
          `(${SKIN_TONE_WORDS}(?:[\\s-]+[\\w-]+){0,3}\\s+(?:skin|complexion|tone))`,
          "i"
        );
        const skinMatch = app.match(skinRe);
        const fallbackSkin = !skinMatch
          ? app.match(/([\w-]+(?:[\s-][\w-]+){0,3}\s+(?:skin|complexion))/i)
          : null;

        //  4. FACE SHAPE
        // Captures: "oval face", "square jaw", "heart-shaped face", "strong angular jaw",
        // "round face with full cheeks", "diamond-shaped face", etc.
        const FACE_SHAPE_WORDS =
          "(?:oval|round|square|rectangular|heart|heart-shaped|diamond|oblong|long|" +
          "triangular|inverted-triangle|angular|soft|strong|defined|wide|narrow|" +
          "prominent|high|sharp|gentle|delicate|chiselled|chiseled)";
        const faceRe = new RegExp(
          `(${FACE_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+(?:face|jaw|chin|cheekbones?|forehead))`,
          "i"
        );
        const faceMatch = app.match(faceRe);
        const fallbackFace = !faceMatch
          ? app.match(
              /([\w-]+(?:[\s-][\w-]+){0,4}\s+(?:face|jaw|chin|cheekbones?))/i
            )
          : null;

        //  5. HAIR STYLE
        // Captures the cut/length/texture AFTER the colour word.
        // e.g. "short side-parted undercut", "long wavy hair", "shoulder-length bob",
        // "tight coily afro", "straight blunt fringe", "messy textured crop".
        const HAIR_STYLE_WORDS =
          "(?:short|medium|long|shoulder-length|chin-length|ear-length|cropped|buzzed|shaved|" +
          "straight|wavy|curly|coily|kinky|frizzy|sleek|smooth|textured|layered|voluminous|" +
          "side-parted|centre-parted|center-parted|slicked|pompadour|undercut|fade|taper|" +
          "bob|lob|pixie|afro|dreadlocks?|braided|cornrows?|bun|ponytail|updo|fringe|bangs)";
        const hairStyleRe = new RegExp(
          `(${HAIR_STYLE_WORDS}(?:[\\s-]+[\\w-]+){0,5}\\s+hair(?:[\\w\\s,'-]{0,30})?)`,
          "i"
        );
        const hairStyleMatch = app.match(hairStyleRe);
        const fallbackHairStyle = !hairStyleMatch
          ? app.match(
              /([\w-]+(?:[\s-][\w-]+){0,5}\s+hair(?:[\w\s,'-]{0,30})?)/i
            )
          : null;

        //  6. EYE SHAPE
        // Captures: "almond-shaped eyes", "round wide-set eyes", "hooded deep-set eyes",
        // "monolid eyes", "upturned eyes", "heavy-lidded eyes", "large expressive eyes".
        const EYE_SHAPE_WORDS =
          "(?:almond|almond-shaped|round|wide|wide-set|close-set|deep-set|hooded|monolid|" +
          "upturned|downturned|heavy-lidded|heavy|large|small|narrow|slanted|angular|" +
          "expressive|bright|piercing|intense|soft|gentle|sleepy|bedroom)";
        const eyeShapeRe = new RegExp(
          `(${EYE_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+eyes)`,
          "i"
        );
        const eyeShapeMatch = app.match(eyeShapeRe);
        const fallbackEyeShape = !eyeShapeMatch
          ? app.match(/([\w-]+(?:[\s-][\w-]+){0,4}\s+eyes)/i)
          : null;

        //  7. NOSE SHAPE
        // Captures: "straight nose", "button nose", "aquiline nose", "broad flat nose",
        // "narrow pointed nose", "upturned snub nose", "prominent Roman nose".
        const NOSE_SHAPE_WORDS =
          "(?:straight|button|snub|upturned|aquiline|roman|hawk|hooked|broad|flat|wide|" +
          "narrow|pointed|rounded|bulbous|prominent|small|large|petite|refined|defined|" +
          "high-bridged|low-bridged|flared|thin|thick)";
        const noseRe = new RegExp(
          `(${NOSE_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+nose(?:[\\w\\s,'-]{0,20})?)`,
          "i"
        );
        const noseMatch = app.match(noseRe);
        const fallbackNose = !noseMatch
          ? app.match(/([\w-]+(?:[\s-][\w-]+){0,4}\s+nose)/i)
          : null;

        //  8. EYEBROWS
        // Captures: "thick straight dark-brown brows", "thin arched brows",
        // "bushy natural eyebrows", "sparse light brows", "bold defined brows".
        const EYEBROW_WORDS =
          "(?:thick|thin|bushy|sparse|full|arched|straight|curved|flat|angular|tapered|" +
          "bold|defined|groomed|natural|unruly|feathered|pencil-thin|heavy|light|" +
          "dark|medium|fair|blonde|blond|brown|black|grey|gray|auburn|red)";
        const browRe = new RegExp(
          `(${EYEBROW_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+(?:eyebrows?|brows?))`,
          "i"
        );
        const browMatch = app.match(browRe);
        const fallbackBrow = !browMatch
          ? app.match(/([\w-]+(?:[\s-][\w-]+){0,4}\s+(?:eyebrows?|brows?))/i)
          : null;

        //  9. BODY SHAPE
        // Captures: "tall athletic build", "petite slim frame", "stocky muscular build",
        // "medium height heavyset frame", "lean wiry physique", "broad-shouldered build".
        const BODY_SHAPE_WORDS =
          "(?:tall|short|medium|average|petite|towering|statuesque|" +
          "slim|slender|lean|wiry|lithe|athletic|fit|toned|muscular|stocky|" +
          "heavyset|heavy-set|broad|broad-shouldered|wide|narrow|slight|" +
          "chubby|plump|rotund|portly|overweight|plus-size|curvy|voluptuous)";
        const bodyRe = new RegExp(
          `(${BODY_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,5}\\s+(?:build|frame|figure|physique|stature|body|height))`,
          "i"
        );
        const bodyMatch = app.match(bodyRe);
        const fallbackBody = !bodyMatch
          ? app.match(
              /([\w-]+(?:[\s-][\w-]+){0,5}\s+(?:build|frame|figure|physique|stature))/i
            )
          : null;

        //  10. FACIAL HAIR
        // Captures: "clean-shaven", "short dark stubble", "full neatly-trimmed brown beard",
        // "thin moustache", "goatee", "mutton chops", "five o'clock shadow".
        //
        // DESIGN: The pattern MUST be anchored to a facial-hair NOUN so that colour/modifier
        // words like "dark", "light", "brown" (which also appear in hair/eye descriptions)
        // do not produce false positives. Two sub-patterns are used:
        //   1. Noun-first: bare nouns that are unambiguously facial hair (stubble, goatee, etc.)
        //   2. Adjective + noun: optional colour/style modifiers followed by a facial-hair noun
        const FACIAL_HAIR_NOUNS =
          "(?:stubble|five-o'clock-shadow|five o'clock shadow|" +
          "beard|bearded|goatee|moustache|mustache|sideburns|mutton-chops|mutton chops)";
        const FACIAL_HAIR_MODIFIERS =
          "(?:clean-shaven|clean shaven|full|short|long|thick|thin|heavy|patchy|sparse|" +
          "neatly-trimmed|neatly trimmed|trimmed|groomed|dark|light|grey|gray|white|black|" +
          "brown|blonde|blond|red|auburn)";
        const facialHairRe = new RegExp(
          // Either a bare noun-first match OR modifier(s) followed by a facial-hair noun
          `(clean-shaven|clean shaven|${FACIAL_HAIR_MODIFIERS}(?:[\\s-]+[\\w-]+){0,3}[\\s-]+${FACIAL_HAIR_NOUNS}|${FACIAL_HAIR_NOUNS}(?:[\\s-]+[\\w-]+){0,3})`,
          "i"
        );
        const facialHairMatch = app.match(facialHairRe); //  Fallback: capture any "<colour> hair" or "<colour> eyes" not caught above
        // This handles unusual descriptors the primary patterns might miss.
        const fallbackHair = !hairMatch
          ? app.match(/([\w-]+(?:[\s-][\w-]+){0,3}\s+hair)/i)
          : null;
        const fallbackEye = !eyeMatch
          ? app.match(/([\w-]+(?:[\s-][\w-]+){0,2}\s+eyes)/i)
          : null;

        // Assemble all matched axes into an ordered array
        const parts = [
          (hairMatch?.[1] ?? fallbackHair?.[1])?.trim(),
          (eyeMatch?.[1] ?? fallbackEye?.[1])?.trim(),
          (skinMatch?.[1] ?? fallbackSkin?.[1])?.trim(),
          (faceMatch?.[1] ?? fallbackFace?.[1])?.trim(),
          (hairStyleMatch?.[1] ?? fallbackHairStyle?.[1])?.trim(),
          (eyeShapeMatch?.[1] ?? fallbackEyeShape?.[1])?.trim(),
          (noseMatch?.[1] ?? fallbackNose?.[1])?.trim(),
          (browMatch?.[1] ?? fallbackBrow?.[1])?.trim(),
          (bodyMatch?.[1] ?? fallbackBody?.[1])?.trim(),
          facialHairMatch?.[1]?.trim(),
        ].filter(Boolean);
        return parts.length > 0 ? `${c.name}: ${parts.join(", ")}` : null;
      })
      .filter(Boolean)
      .join(" | ");

    // PHYSICAL_IDENTITY_LOCK: combines all 10 visual axes extracted above.
    // This replaces the old CHARACTER_COLOUR_LOCK (which only covered hair/eye colour)
    // and is injected into STYLE_LOCK and every per-page/panel prompt.
    // Keeping the old constant name for backward compat with STYLE_LOCK assembly below.
    const CHARACTER_COLOUR_LOCK = colourKeywords
      ? `PHYSICAL IDENTITY LOCK  do NOT change ANY of these physical traits in any illustration: ${colourKeywords}`
      : "";

    //  Guardrail 2B: Centralised no-text constraint
    // This constant is injected into EVERY image prompt to prevent the model from
    // rendering any text, typography, or title/author text inside the image.
    // Title and author metadata are rendered by the product UI, not baked into the generated cover image.
    const NO_TEXT_CONSTRAINT = getNoTextRule();
    const HUMAN_ANATOMY_LOCK =
      "HUMAN ANATOMY LOCK: every visible human character must have exactly one head, one torso, two arms, two hands, and two legs with physically plausible joints and placement. No extra limbs, duplicated arms, fused hands, missing hands, cloned body parts, or impossible anatomy.";

    // Guardrail 2C: Comic panel character hard-lock instruction
    // Appended to every comic panel prompt after the per-panel speaker focus note.
    // Prevents per-panel character drift by explicitly repeating the full physical identity lock.
    // ENHANCED: Added explicit character count enforcement, negative prompts, and visual distinctness rules.
    const CHARACTER_LOCK_INSTRUCTION =
      "CRITICAL CHARACTER CONSISTENCY & UNIQUENESS RULES:\n" +
      "1. IDENTITY LOCK: Render each character with the EXACT same face shape, skin tone, hair colour, hair style, eye colour, eye shape, nose shape, eyebrows, body build, and facial hair as described in the PHYSICAL IDENTITY LOCK. Never deviate.\n" +
      "2. FEATURE PRESERVATION: Do NOT alter, genericise, or simplify any facial feature. Preserve every distinctive feature exactly as specified.\n" +
      "3. MANDATORY VISUAL DISTINCTNESS: If multiple characters appear in the same image, EACH character MUST be COMPLETELY VISUALLY DIFFERENT from all others. Different face shapes, different eye colors, different hair colors, different body builds, different clothing styles.\n" +
      "4. CHARACTER SEPARATION: Render each character in a distinct spatial location (left, center, right) to prevent visual blending or confusion.\n" +
      "5. NEGATIVE CONSTRAINTS (CRITICAL): NEVER duplicate any character. NEVER show the same person twice. NEVER blend two characters' features. NEVER create lookalikes or similar-looking characters. ZERO tolerance for character repetition.\n" +
      "6. CHARACTER COUNT ENFORCEMENT: Render EXACTLY the number of characters mentioned. Not one more, not one fewer. If 4 characters are specified, render 4 distinct individuals.\n" +
      "7. VISUAL CONTRAST RULES: Use maximum contrast between characters:\n" +
      "   - Hair: If one has long straight hair, another has short curly hair. If one is blonde, another is dark-haired.\n" +
      "   - Face: If one has round face, another has angular face. If one has large eyes, another has smaller eyes.\n" +
      "   - Body: If one is tall/muscular, another is shorter/slender. If one is young, another is older.\n" +
      "   - Clothing: Each character wears distinctly different clothing colors and styles.\n" +
      "8. PHOTO REFERENCE PRIORITY: If character photos are provided, render faces EXACTLY as photographed. Do not alter facial structure, features, or appearance.\n" +
      "9. QUALITY ASSURANCE: Before finalizing, verify that every character is visually distinct and cannot be confused with any other character in the image.";
    //  Assemble the global STYLE_LOCK string
    // This string is prepended to EVERY generateImage prompt in this book so that
    // all illustrations share the same art style, lighting, palette, and framing.
    // It is also stored in books.illustrationStyleLock for admin/debug inspection.
    // Global identity lock — prepended to every generateImage call.
    const CATEGORY_IDENTITY_STYLE_WORDING: Record<string, string> = {
      fairy_tale: "pixar",
      comic: "çizgi roman",
      horror_thriller: "gerçekçi ama sinematif çizim",
      romance: "gerçekçi ama sinematif çizim",
      crime_mystery: "gerçekçi ama sinematif çizim",
      fantasy_scifi: "fantastik sanat stili",
    };
    const categoryAwareIdentityInstruction = `Fotoğraftaki kişinin yüz hatlarını ve oranlarını birebir koruyarak, yüz kimliğini bozmadan onun ${CATEGORY_IDENTITY_STYLE_WORDING[category] || "gerçekçi ama sinematif çizim"} karakterini oluştur.`;
    const strictCategoryAwareIdentityInstruction = `Render the referenced person as ${
      (
        {
          fairy_tale: "storybook illustration with a gentle painterly finish",
          comic: "classic comic-book illustration",
          horror_thriller: "cinematic illustrated realism",
          romance: "cinematic illustrated realism",
          crime_mystery: "cinematic illustrated realism",
          fantasy_scifi: "epic fantasy illustration",
        } as Record<string, string>
      )[category] || "cinematic illustrated realism"
    } while preserving the exact same face identity, age impression, body proportions, hairstyle, signature features, and clothing silhouette.`;
    const IDENTITY_LOCK =
      "CRITICAL IDENTITY PRESERVATION: Every character in this image MUST be the EXACT SAME PERSON as the uploaded reference photo. " +
      "Do NOT redesign, beautify, genericise, or replace any face. " +
      "Preserve WITHOUT EXCEPTION: face shape, skin tone, eye colour, hairline, haircut, facial proportions, and age impression. " +
      "Preserve the uploaded person's facial proportions and signature look so stylization never turns them into a generic AI character. " +
      "The same character MUST look visually identical across every page and panel of this book. " +
      "If the requested art style conflicts with identity fidelity, IDENTITY WINS. Override style for face accuracy.";

    // Style-bridge rule — added to portrait prompt only (style conversion, not new character).
    const STYLE_BRIDGE_RULE =
      "STYLE CONVERSION ONLY: This is NOT a new or redesigned character. " +
      "Convert the rendering style only. The person MUST look like the EXACT SAME real individual from the reference photo. " +
      "Change only the artistic rendering style. Preserve all facial features, identity markers, and personal likeness without exception. " +
      "Do NOT beautify, heroize, glamorize, age-shift, slim down, sharpen the jaw, enlarge the eyes, refine the nose, smooth the skin, or idealize facial proportions.";

    const STYLE_LOCK = [
      `GLOBAL STYLE PROFILE: medium=${globalStyleProfile.medium}; lighting=${globalStyleProfile.lighting}; palette=${globalStyleProfile.palette}; linework=${globalStyleProfile.linework}; composition=${globalStyleProfile.composition}`,
      stylePreset,
      strictCategoryAwareIdentityInstruction,
      NO_TEXT_CONSTRAINT,
      charAnchorBlock,
      CHARACTER_COLOUR_LOCK,
      // Inject the full structured photo-analysis block so the image model has
      // axis-by-axis facial/body descriptors for every character with a reference photo.
      STRUCTURED_IDENTITY_BLOCK || undefined,
      "STYLE CONSISTENCY: This illustration must match the exact same art style, lighting, colour palette, and character appearance as all other illustrations in this book.",
    ]
      .filter(Boolean)
      .join(" | ");

    //  Step 1b: Style-bridge portrait generation
    // For every character with an uploaded photo, generate ONE illustrated portrait
    // in the book's art style by passing the raw photo as originalImages.
    //
    // WHY THIS WORKS:
    //   - Passing a raw photo as originalImages causes a photo-collage effect
    //     (the person is composited directly onto the illustrated background).
    //   - But passing an ALREADY-ILLUSTRATED portrait as originalImages gives the
    //     image model a proper style reference without the collage artifact.
    //
    // APPROACH:
    //   1. Generate portrait: raw photo  illustrated portrait (style conversion)
    //      The prompt explicitly asks to convert the photo to the book's art style
    //      while preserving exact facial features, hair, and build.
    //   2. Store the illustrated portrait in S3.
    //   3. Use the illustrated portrait (not the raw photo) as originalImages for
    //      all subsequent page/panel generation calls.
    //
    // This is a non-fatal step  if portrait generation fails for any character,
    // we fall back to text-only anchoring (the existing PHYSICAL_IDENTITY_LOCK).
    const illustratedPortraitsMap = new Map<
      string,
      { url: string; mimeType: string }
    >();

    await db
      .update(books)
      .set({ generationStep: "Creating character illustrations…" })
      .where(eq(books.id, bookId));

    for (const char of characters) {
      if (!char.photoUrl) continue;
      try {
        console.log(
          `[Books] Step 1b: Generating style-bridge portrait for "${char.name}" (bookId=${bookId})`
        );
        let portraitPhotoB64: string;
        let portraitPhotoMime: string;
        try {
          const pRes = await fetch(char.photoUrl);
          if (!pRes.ok) throw new Error(`${pRes.status} ${pRes.statusText}`);
          portraitPhotoMime = pRes.headers.get("content-type") || "image/jpeg";
          portraitPhotoB64 = Buffer.from(await pRes.arrayBuffer()).toString(
            "base64"
          );
        } catch (fetchErr) {
          console.warn(
            `[Books] Step 1b: Could not download photo for "${char.name}", skipping portrait:`,
            fetchErr
          );
          continue;
        }
        const a = photoAnalyses[char.name];
        // Build a precise style-conversion prompt using the extracted appearance axes
        const appearanceHint = a
          ? [
              `${a.hair_colour} ${a.hair_style}`,
              `${a.eye_colour} eyes`,
              a.skin_tone,
              a.face_shape,
              a.body_shape,
              a.outfit_summary || "",
              a.accessories && a.accessories !== "none" ? a.accessories : "",
              a.headwear && a.headwear !== "none" ? a.headwear : "",
              a.facial_hair !== "none" ? a.facial_hair : "",
              a.distinctive !== "none" ? a.distinctive : "",
            ]
              .filter(Boolean)
              .join(", ")
          : char.name;
        // Three-tier style mapping: fairy_tale → cartoon/storybook,
        // comic → American comic, all others → cinematic/realistic.
        const genreStyleLabel =
          category === "comic"
            ? "classic American comic book illustration"
            : category === "fairy_tale"
              ? "classic children's storybook cartoon illustration"
              : "cinematic realistic illustrated";
        const portraitPrompt = [
          IDENTITY_LOCK,
          STYLE_BRIDGE_RULE,
          strictCategoryAwareIdentityInstruction,
          stylePreset,
          `Preserve the EXACT facial features and identity of the person in this photograph. Transform them into a ${genreStyleLabel} style character while keeping face identity 100% recognizable`,
          "Likeness lock: preserve the same craniofacial proportions, jaw width, eye spacing, nose length, lip shape, cheek volume, and age impression as the source photo.",
          `Preserve EXACTLY: the person's face shape, facial features, ${appearanceHint}`,
          `The illustrated character must be immediately recognisable as the same person from the photo`,
          `Full-body or bust portrait, neutral background, character centred`,
          `Illustration style only  no photographic elements, no photo-realistic rendering`,
          NO_TEXT_CONSTRAINT,
        ]
          .filter(Boolean)
          .join(". ");

        const portraitResult = await generateImage({
          prompt: portraitPrompt,
          originalImages: [
            { b64Json: portraitPhotoB64, mimeType: portraitPhotoMime },
          ],
          hardIdentity: true,
          noText: true,
        });

        if (portraitResult.url) {
          illustratedPortraitsMap.set(char.name, {
            url: portraitResult.url,
            mimeType: portraitResult.mimeType || "image/webp",
          });
          console.log(
            `[Books] Step 1b: Style-bridge portrait for "${char.name}" stored at ${portraitResult.url}`
          );
        }
      } catch (portraitErr) {
        console.warn(
          `[Books] Step 1b: Portrait generation failed for "${char.name}", falling back to text-only anchoring:`,
          portraitErr
        );
      }
    }

    const getCharacterReferenceImages = (
      characterNames?: string[]
    ): Array<{ url: string; mimeType: string }> => {
      const names =
        characterNames && characterNames.length > 0
          ? Array.from(new Set(characterNames))
          : canonicalCharacterProfiles.map(profile => profile.name);
      const refs: Array<{ url: string; mimeType: string }> = [];
      for (const name of names) {
        const illustrated = illustratedPortraitsMap.get(name);
        if (illustrated?.url)
          refs.push({ url: illustrated.url, mimeType: illustrated.mimeType });
        else {
          const raw = photoRefByName.get(name);
          if (raw?.url) refs.push({ url: raw.url, mimeType: raw.mimeType });
        }
      }
      if (refs.length === 0) {
        const portraitFallback = Array.from(illustratedPortraitsMap.values())
          .filter((img): img is { url: string; mimeType: string } => !!img?.url)
          .map(img => ({ url: img.url, mimeType: img.mimeType }));
        if (portraitFallback.length > 0) {
          refs.push(...portraitFallback);
        } else {
          refs.push(
            ...charPhotos.map(img => ({
              url: img.url,
              mimeType: img.mimeType as string,
            }))
          );
        }
      }
      return refs.filter(
        (img, idx, arr) =>
          arr.findIndex(candidate => candidate.url === img.url) === idx
      );
    };

    const buildSceneIdentityPriorityBlock = (
      characterNames?: string[]
    ): string => {
      const names =
        characterNames && characterNames.length > 0
          ? Array.from(new Set(characterNames))
          : canonicalCharacterProfiles.map(profile => profile.name);
      const blocks = names
        .map(name => {
          const canonical = canonicalCharacterProfiles.find(
            profile => profile.name === name
          );
          if (!canonical) return "";
          const photo = photoAnalyses[name];
          return [
            `CHARACTER PRIORITY: ${name}`,
            `Face lock: ${canonical.identityLock}`,
            `Age lock: ${canonical.ageLock}`,
            `Outfit lock: ${canonical.clothingLock}`,
            photo?.outfit_summary
              ? `Exact photographed outfit: ${photo.outfit_summary}`
              : "",
            photo?.accessories && photo.accessories.toLowerCase() !== "none"
              ? `Exact accessories: ${photo.accessories}`
              : "",
            photo?.headwear && photo.headwear.toLowerCase() !== "none"
              ? `Exact headwear/hair accessory: ${photo.headwear}`
              : "",
            "RAW PHOTO PRIORITY: face shape, haircut, eyebrows, skin tone, outfit, accessories, and age impression must match the uploaded photo exactly; style-bridge portraits only transfer illustration style.",
            "Do not replace this character with a generic cartoon version.",
          ]
            .filter(Boolean)
            .join(" | ");
        })
        .filter(Boolean);

      return blocks.length > 0
        ? `SCENE-SPECIFIC IDENTITY PRIORITY:\n${blocks.join("\n")}`
        : "";
    };

    //  Image generation wrapper
    // Uses illustrated portraits (Step 1b) as originalImages when available.
    // Illustrated portraits are already in the book's art style so they serve
    // as a proper style/identity reference without causing the photo-collage effect
    // (which only occurs when a raw photograph is passed as originalImages).
    // Falls back to text-only anchoring if no portraits were generated.
    const generateImageWithRefCheck = async (
      stage: string,
      prompt: string,
      refImages?: Array<{ url?: string; b64Json?: string; mimeType?: string }>
    ) => {
      type ReferenceCandidate = {
        url?: string;
        b64Json?: string;
        mimeType?: string;
      };

      const fallbackPortraitRefs: ReferenceCandidate[] = Array.from(
        illustratedPortraitsMap.values()
      )
        .filter(img => !!img?.url)
        .map(img => ({ url: img.url, mimeType: img.mimeType }));
      const portraitRefUrls = new Set(
        fallbackPortraitRefs
          .map(img => img.url)
          .filter((url): url is string => !!url)
      );
      const explicitRefs: ReferenceCandidate[] = (refImages ?? []).filter(
        (img): img is { url?: string; mimeType?: string; b64Json?: string } =>
          !!img?.url || !!img?.b64Json
      );
      const rawPhotoRefs: ReferenceCandidate[] = charPhotos
        .filter(img => !!img?.url)
        .map(img => ({ url: img.url, mimeType: img.mimeType }));
      const rawPhotoUrls = new Set(
        rawPhotoRefs
          .map(img => img.url)
          .filter((url): url is string => !!url)
      );
      const explicitPortraitRefs = explicitRefs.filter(
        img => !!img.url && portraitRefUrls.has(img.url)
      );
      const explicitNeutralRefs = explicitRefs.filter(
        img => !img.url || (!portraitRefUrls.has(img.url) && !rawPhotoUrls.has(img.url))
      );
      const explicitRawPhotoRefs = explicitRefs.filter(
        img => !!img.url && rawPhotoUrls.has(img.url)
      );
      const hasPortraitReference =
        explicitPortraitRefs.length > 0 || fallbackPortraitRefs.length > 0;
      const candidateRefs = [
        ...explicitPortraitRefs,
        ...explicitNeutralRefs,
        ...fallbackPortraitRefs,
        ...(hasPortraitReference
          ? []
          : [...explicitRawPhotoRefs, ...rawPhotoRefs]),
      ];
      const mergedRefs = candidateRefs
        .filter(
          (img, idx, arr) =>
            arr.findIndex(
              candidate =>
                (candidate.url ?? "") === (img.url ?? "") &&
                (candidate.b64Json ?? "") === (img.b64Json ?? "")
            ) === idx
        )
        .slice(0, 6);

      const identityAuthorityLayer =
        charPhotos.length > 0
          ? "USER PHOTO LIKENESS LOCK (MANDATORY): preserve the exact identity from the uploaded reference photos, but render every person fully as an illustration in the locked book style. Never paste, collage, photobash, trace, or leave visible photographic fragments in the final image. Use the uploaded photos as likeness truth only."
          : "";
      const effectivePrompt = [
        prompt.includes(IDENTITY_LOCK) ? "" : IDENTITY_LOCK,
        HUMAN_ANATOMY_LOCK,
        identityAuthorityLayer,
        prompt,
      ]
        .filter(Boolean)
        .join("\n\n");

      const maxImageAttempts = 3;
      let lastErr: string | null = null;
      for (let attempt = 1; attempt <= maxImageAttempts; attempt++) {
        try {
          if (mergedRefs.length > 0) {
            const rawRefCount = mergedRefs.filter(
              ref =>
                !!ref.url && charPhotos.some(photo => photo.url === ref.url)
            ).length;
            const portraitRefCount = mergedRefs.filter(
              ref =>
                !!ref.url &&
                Array.from(illustratedPortraitsMap.values()).some(
                  portrait => portrait.url === ref.url
                )
            ).length;
            console.log(
              `[Books] Generating image for bookId=${bookId} stage=${stage} (reference mode ${mergedRefs.length} image reference(s): ${portraitRefCount} portrait, ${rawRefCount} raw photo; attempt ${attempt}/${maxImageAttempts})`
            );
            const result = await generateImage({
              prompt: effectivePrompt,
              originalImages: mergedRefs,
              hardIdentity: true,
              noText: true,
            });
            if (result?.url) return result;
            lastErr = `Image API returned no URL (attempt ${attempt})`;
          } else {
            console.log(
              `[Books] Generating image for bookId=${bookId} stage=${stage} (text-anchor mode  no usable references, attempt ${attempt}/${maxImageAttempts})`
            );
            const result = await generateImage({
              prompt: effectivePrompt,
              hardIdentity: true,
              noText: true,
            });
            if (result?.url) return result;
            lastErr = `Image API returned no URL (attempt ${attempt})`;
          }
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }

        if (attempt < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 700 * attempt));
        }
      }

      throw new Error(
        `Image generation failed for ${stage} after ${maxImageAttempts} attempts: ${lastErr ?? "unknown error"}`
      );
    };

    //  Step 2: Generate story structure (outline pass)
    // This pass generates the full branching skeleton. Content is short (1-2
    // sentences per page)  the per-page expansion pass will enrich it.
    await db
      .update(books)
      .set({ generationStep: "Crafting story structure…" })
      .where(eq(books.id, bookId));
    const structureSystemPrompt = `You are a creative gamebook author. Always respond with valid JSON only.${characterCardBlock}

CONTINUITY RULES:
- Use character names exactly as defined in the character cards above  no aliases
- Character appearances and personalities must remain consistent across all pages
- Every branch path must reach a satisfying ending
- The story must be internally consistent  no contradictions

UNICODE RULES (MANDATORY):
- NEVER strip, normalize, transliterate, or replace special characters
- Preserve ALL Unicode characters exactly as written (Turkish: c with cedilla, g with breve, dotless i, o with umlaut, s with cedilla, u with umlaut; German: a/o/u umlaut, sharp s; French accents; Spanish tilde-n; Cyrillic; Chinese; Japanese; Arabic)
- Output text in the exact language and script requested  do not substitute ASCII equivalents

BRANCHING RULES (MANDATORY  violations will cause story rejection):
- Branches must NEVER merge back together. Once the reader selects A or B, the story continues on a unique, permanently separate branch path.
- Each page node must belong to exactly ONE branch path. A pageNumber must NEVER appear as the target of nextPageA or nextPageB on more than one page.
- Do NOT reuse page numbers across different branch paths. Every page is unique and exclusive to its branch.
- branchPath values must reflect the lineage: "root", "A", "B", "A-A", "A-B", "B-A", "B-B", etc.
- ILLEGAL merge example (FORBIDDEN): page 3 has nextPageA=7 AND page 5 also has nextPageA=7. Page 7 appears as a target twice — this is a merge violation. NEVER let any pageNumber appear as the value of nextPageA or nextPageB on more than one page across the ENTIRE story.
- The page immediately reached after a branch choice (nextPageA target and nextPageB target) MUST be a narrative page with isBranchPage=false. Do NOT chain branch pages — no branch target may itself be a branch page.
- For non-branch, non-ending pages, nextPageA is the single linear continuation edge on that branch path and nextPageB must be null.
- TWO CHOICES MANDATORY: Every branch page (isBranchPage=true) MUST have non-null choiceA AND non-null choiceB. NEVER generate a branch page with only one choice. Both choices must lead to different next pages and must represent meaningfully different narrative directions.
- The LAST page on EVERY branch path MUST have isEnding=true and null nextPageA/nextPageB.`;

    // Pre-compute evenly distributed branch page numbers so the LLM cannot cluster them.
    // Reserve the first pages for setup and leave at least 2 pages at the end for endings.
    const branchStartPage = category === "fairy_tale" ? 3 : 4;
    const branchEndPage = Math.max(
      branchStartPage + branchCount,
      pageCount - 2
    );
    const branchSpacing =
      branchCount > 1
        ? Math.floor((branchEndPage - branchStartPage) / (branchCount - 1))
        : 0;
    const precomputedBranchPages = Array.from(
      { length: branchCount },
      (_, i) =>
        branchCount === 1
          ? Math.round((branchStartPage + branchEndPage) / 2) // single branch: place in middle
          : branchStartPage + i * branchSpacing
    );
    const comicStructureRules = isComic
      ? `- COMIC STORY RULES: every page outline must imply 3 distinct sequential panel beats (setup, confrontation, consequence), not one vague mood.
- Avoid repetitive filler inner-monologue such as generic hurry/panic phrases unless the exact wording is uniquely motivated by the scene.
- Most comic pages should include another person, creature, crowd, ally, victim, or opposing force. If the protagonist is alone, the page must still contain a strong external obstacle or environmental threat.
- Dialogue should arise from conflict, collaboration, persuasion, warning, interrogation, or emotional exchange. Do not make the protagonist talk to themselves unless absolutely necessary.
- Branch pages must present concrete tactical or emotional dilemmas that clearly change the next scene.`
      : "";

    const structurePrompt = `Generate a ${category.replace(/_/g, " ")} interactive gamebook titled "${title}" in ${language} language.
Description: ${description}

Generate a branching graph with exactly ${graphPageCount} total pages and exactly ${branchCount} branch points (A/B choices only).
Every complete readable path from the opening page to an ending MUST contain exactly ${pageCount} pages.
Format as JSON:
{
  "pages": [
    {
      "pageNumber": 1,
      "branchPath": "root",
      "isBranchPage": false,
      "isEnding": false,
      "content": "narrative text (2-3 sentences for fairy tales, 3-5 sentences for others)",
      "sfxTags": ["forest", "birds"],
      "choiceA": null,
      "choiceB": null,
      "nextPageA": null,
      "nextPageB": null
    }
  ]
}

Rules:
- Treat ${pageCount} as the number of pages a reader should experience on one full playthrough, not the total future graph size.
- This is a readable-route skeleton. The engine will later expand it into a larger branching graph.
- LANGUAGE LOCK: ALL page content, choiceA, and choiceB text MUST be written entirely in ${language}. Never use English placeholder text unless ${language} is English.
- Branch pages: isBranchPage=true. MANDATORY: BOTH choiceA AND choiceB MUST be non-null text strings. BOTH nextPageA AND nextPageB MUST point to different valid page numbers. A branch page with only one choice is STRICTLY INVALID - always provide exactly two distinct choices with distinct targets.
- Linear narrative pages: if isBranchPage=false and isEnding=false, nextPageA MUST point to the next page on that same readable path, and nextPageB MUST be null.
- Ending pages: isEnding=true, no choices, no nextPage references.
- CRITICAL: The page reached via nextPageA MUST open with narrative that directly continues from choiceA. The page reached via nextPageB MUST continue from choiceB. The reader must feel their choice mattered.
- Total graph size must be larger than the readable path length. Never confuse the two numbers.
- ALL paths must reach an isEnding=true page  no dead ends
- STORY BEGINNING: Page 1 MUST be a proper story opening  introduce the main characters, set the scene and world, and establish the context. The reader should feel they are starting a brand-new adventure, NOT joining in the middle of one.
- MANDATORY BRANCH POSITIONS (CRITICAL): Place your ${branchCount} A/B branch point(s) on EXACTLY these page numbers: [${precomputedBranchPages.join(", ")}]. Do NOT place branch points on any other pages. Do NOT cluster branch points on consecutive pages. Each branch point must be separated by at least ${Math.max(2, branchSpacing - 1)} pages of narrative.
- sfxTags: 1-3 English keywords matching the scene sound. Be specific  use common audio library keywords like "wind", "rocket_launch", "spaceship", "forest_ambience", "ocean_waves", "thunder", "birds_chirping", "fire_crackling", "heartbeat", "rain", "footsteps", "door_creak", "horse_gallop", "sword_clash". NEVER leave sfxTags as an empty array  every page MUST have at least one relevant sound effect tag.
- If new supporting characters appear, establish them clearly through action or role (guard, scientist, sibling, rival, crowd leader, etc.) so later pages can refer to them consistently.
- For fairy tales: 2-3 sentences per page
- For comics: 3-4 panel descriptions per page
- For others: 3-5 sentence narrative paragraphs
${comicStructureRules}`;

    type StoryData = {
      pages: Array<{
        pageNumber: number;
        branchPath: string;
        isBranchPage: boolean;
        isEnding?: boolean;
        content: string;
        outlineContent?: string;
        sfxTags: string[];
        choiceA: string | null;
        choiceB: string | null;
        nextPageA: number | null;
        nextPageB: number | null;
      }>;
    };

    let storyData: StoryData | null = null;
    let structureErr: string | null = null;
    const maxStructureAttempts = 3;
    const useDeterministicScaffoldTopology = true;
    const parseStoryDataFromRaw = (raw: string): StoryData => {
      try {
        return JSON.parse(repairJSON(raw)) as StoryData;
      } catch (_) {
        const extracted = extractLikelyJsonObject(raw);
        return JSON.parse(repairJSON(extracted)) as StoryData;
      }
    };
    const buildDeterministicScaffoldStory = async (
      invalidDraft?: StoryData | null
    ): Promise<StoryData> => {
      const scaffoldPages = buildFallbackStoryGraph({
        title,
        description,
        readablePathLength: pageCount,
        branchCount,
        category,
        language,
      });

      const scaffoldStory: StoryData = {
        pages: scaffoldPages.map(page => ({
          ...page,
          outlineContent: page.content,
        })),
      };

      const invalidDraftSummary = invalidDraft?.pages?.length
        ? invalidDraft.pages
            .slice(0, Math.min(40, invalidDraft.pages.length))
            .map(page => {
              const choiceBits = page.isBranchPage
                ? ` choices=(${page.choiceA ?? "null"} | ${page.choiceB ?? "null"})`
                : "";
              return `Page ${page.pageNumber} [${page.branchPath}] branch=${page.isBranchPage} ending=${page.isEnding ? "yes" : "no"} next=(${page.nextPageA ?? "null"}, ${page.nextPageB ?? "null"})${choiceBits} content=${(page.content ?? "").slice(0, 180)}`;
            })
            .join("\n")
        : "No usable invalid draft was available.";

      try {
        const repairResp = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: `You are a gamebook structure repair author. Output valid JSON only.${characterCardBlock}

Your task is NOT to invent a new graph topology. You must preserve the provided scaffold exactly and only enrich page text, branch choices, and sound tags.

MANDATORY TOPOLOGY RULES:
- Keep EVERY pageNumber exactly as given in the scaffold.
- Keep EVERY branchPath exactly as given in the scaffold.
- Keep isBranchPage, isEnding, nextPageA, and nextPageB exactly as given in the scaffold.
- Do not add or remove pages.
- Do not merge branches.
- The scaffold already guarantees that every playable route has exactly ${pageCount} readable pages; preserve that.

WRITING RULES:
- All content and choices must be fully written in ${language}.
- Page 1 must feel like a true beginning.
- Branch pages must present two clearly different narrative directions.
- The page reached after choice A must immediately continue choice A.
- The page reached after choice B must immediately continue choice B.
- Preserve continuity of characters, props, and stakes.
- Return 1-3 specific English sfxTags per page.

UNICODE RULE:
- Preserve all Unicode exactly as written.`,
            },
            {
              role: "user" as const,
              content: `Repair this story by transferring its intent onto the valid scaffold.

TITLE: ${title}
CATEGORY: ${category}
LANGUAGE: ${language}
DESCRIPTION: ${description}

INVALID DRAFT SUMMARY:
${invalidDraftSummary}

VALID SCAFFOLD TO KEEP EXACTLY:
${JSON.stringify(scaffoldStory)}

Return JSON:
{
  "pages": [
    {
      "pageNumber": 1,
      "branchPath": "root",
      "isBranchPage": false,
      "isEnding": false,
      "content": "",
      "outlineContent": "",
      "sfxTags": ["wind"],
      "choiceA": null,
      "choiceB": null,
      "nextPageA": 2,
      "nextPageB": null
    }
  ]
}

You may rewrite content, outlineContent, choiceA, choiceB, and sfxTags only.
All topology fields must remain identical to the scaffold.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: pageCount >= 80 ? 32000 : pageCount >= 18 ? 18000 : 10000,
        });

        const repairRaw = repairResp.choices[0]?.message?.content || "{}";
        let repaired: StoryData;
        try {
          repaired = parseStoryDataFromRaw(
            typeof repairRaw === "string"
              ? repairRaw
              : JSON.stringify(repairRaw)
          );
        } catch (primaryRepairParseErr) {
          const repairContent =
            typeof repairRaw === "string"
              ? repairRaw
              : JSON.stringify(repairRaw);
          const fixerResp = await invokeLLM({
            messages: [
              {
                role: "system" as const,
                content:
                  'You are a strict JSON formatter. Output ONLY valid JSON object with this shape: {"pages":[{...}]}. Preserve content, fix malformed syntax only.',
              },
              {
                role: "user" as const,
                content:
                  `Repair this malformed scaffold-hydration JSON into valid JSON object with key "pages". Do not add commentary.\n\n` +
                  `MALFORMED_INPUT:\n${repairContent.slice(0, 12000)}`,
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 12000,
          });
          const fixerRaw = fixerResp.choices[0]?.message?.content || "{}";
          const fixedContent =
            typeof fixerRaw === "string" ? fixerRaw : JSON.stringify(fixerRaw);
          repaired = parseStoryDataFromRaw(fixedContent);
          console.log(
            `[Books] Scaffold hydration JSON repaired via normalization pass for book ${bookId}`
          );
        }
        const repairedByPage = new Map(
          repaired.pages.map(page => [page.pageNumber, page])
        );

        return {
          pages: scaffoldStory.pages.map(page => {
            const candidate = repairedByPage.get(page.pageNumber);
            const contentValue = candidate?.content?.trim() || page.content;
            const outlineValue =
              candidate?.outlineContent?.trim() || contentValue;
            const sfxTagsValue = Array.isArray(candidate?.sfxTags)
              ? candidate!.sfxTags
                  .map(tag => String(tag ?? "").trim())
                  .filter(Boolean)
                  .slice(0, 3)
              : page.sfxTags;
            return {
              ...page,
              content: contentValue,
              outlineContent: outlineValue,
              sfxTags: sfxTagsValue.length > 0 ? sfxTagsValue : page.sfxTags,
              choiceA: page.isBranchPage
                ? candidate?.choiceA?.trim() || page.choiceA
                : null,
              choiceB: page.isBranchPage
                ? candidate?.choiceB?.trim() || page.choiceB
                : null,
            };
          }),
        };
      } catch (repairErr) {
        console.warn(
          `[Books] Deterministic scaffold hydration failed for book ${bookId}; using raw scaffold content instead.`,
          repairErr
        );
        return scaffoldStory;
      }
    };

    if (useDeterministicScaffoldTopology) {
      storyData = await buildDeterministicScaffoldStory(null);
      structureErr = null;
    } else {
      for (let attempt = 1; attempt <= maxStructureAttempts; attempt++) {
        try {
          const structureResponse = await invokeLLM({
            messages: [
              { role: "system" as const, content: structureSystemPrompt },
              { role: "user" as const, content: structurePrompt },
            ],
            response_format: { type: "json_object" },
            max_tokens:
              pageCount >= 80 ? 32000 : pageCount >= 18 ? 14000 : 8000,
          });

          const rawContent =
            structureResponse.choices[0]?.message?.content || "{}";
          const content =
            typeof rawContent === "string"
              ? rawContent
              : JSON.stringify(rawContent);
          let parsed: StoryData | null = null;
          try {
            parsed = parseStoryDataFromRaw(content);
          } catch (primaryParseErr) {
            const preview = content.slice(0, 240).replace(/\s+/g, " ");
            console.warn(
              `[Books] Primary structure parse error (book ${bookId}, attempt ${attempt}): ${primaryParseErr instanceof Error ? primaryParseErr.message : String(primaryParseErr)}`
            );
            console.warn(
              `[Books] Raw structure preview (book ${bookId}, attempt ${attempt}): ${preview}`
            );

            try {
              const fixerResp = await invokeLLM({
                messages: [
                  {
                    role: "system" as const,
                    content:
                      'You are a strict JSON formatter. Output ONLY valid JSON object with this shape: {"pages":[{...}]}. Preserve content, fix malformed syntax only.',
                  },
                  {
                    role: "user" as const,
                    content:
                      `Repair this malformed gamebook JSON into valid JSON object with key "pages". Do not add commentary.\n\n` +
                      `MALFORMED_INPUT:\n${content.slice(0, 12000)}`,
                  },
                ],
                response_format: { type: "json_object" },
                max_tokens: 12000,
              });
              const fixerRaw = fixerResp.choices[0]?.message?.content || "{}";
              const fixedContent =
                typeof fixerRaw === "string"
                  ? fixerRaw
                  : JSON.stringify(fixerRaw);
              parsed = parseStoryDataFromRaw(fixedContent);
              console.warn(
                `[Books] Structure JSON repaired via normalization pass for book ${bookId} (attempt ${attempt})`
              );
            } catch (fixErr) {
              console.warn(
                `[Books] Structure normalization pass failed for book ${bookId} (attempt ${attempt}): ${fixErr instanceof Error ? fixErr.message : String(fixErr)}`
              );
            }
          }

          if (
            parsed &&
            Array.isArray(parsed.pages) &&
            parsed.pages.length > 0
          ) {
            storyData = parsed;
            structureErr = null;
            break;
          }

          structureErr = `Attempt ${attempt}: empty pages array`;
        } catch (err) {
          structureErr = `Attempt ${attempt}: ${err instanceof Error ? err.message : String(err)}`;
        }

        if (attempt < maxStructureAttempts) {
          console.warn(
            `[Books] Structure generation retry ${attempt}/${maxStructureAttempts} for book ${bookId}: ${structureErr}`
          );
        }
      }
    }

    if (!storyData?.pages?.length) {
      throw new Error(
        `Failed to generate story structure after ${maxStructureAttempts} attempts${structureErr ? ` (${structureErr})` : ""}`
      );
    }

    const structuralShapeErrors = validateStoryShape(
      storyData.pages,
      pageCount
    );
    if (structuralShapeErrors.length > 0) {
      console.warn(
        "[Books] Structure shape validation failed; rebuilding onto deterministic scaffold.",
        {
          bookId,
          structuralShapeErrors,
        }
      );
      storyData = await buildDeterministicScaffoldStory(storyData);
      const scaffoldShapeErrors = validateStoryShape(
        storyData.pages,
        pageCount
      );
      if (scaffoldShapeErrors.length > 0) {
        console.warn(
          "[Books] Deterministic scaffold hydration still invalid; using deterministic fallback graph.",
          {
            bookId,
            scaffoldShapeErrors,
          }
        );
        storyData = {
          pages: buildFallbackStoryGraph({
            title,
            description,
            readablePathLength: pageCount,
            branchCount,
            category,
            language,
          }),
        };
      }
    }

    // Step 3: Post-structure validation
    // Verify all branch references resolve, all paths reach an ending, and
    // GUARDRAIL 1: no page node is reused across multiple branch paths (no-merge rule).
    const localizedChoiceFallbacks = getLocalizedChoiceFallbacks(language);
    const pageNumbers = new Set(storyData.pages.map(p => p.pageNumber));
    const validationErrors: string[] = [];
    const repairActions: string[] = [];
    const targetRefCount = new Map<number, number[]>();
    for (const page of storyData.pages) {
      if (page.isBranchPage) {
        if (page.nextPageA && !pageNumbers.has(page.nextPageA)) {
          const msg = `Page ${page.pageNumber}: nextPageA=${page.nextPageA} does not exist`;
          validationErrors.push(msg);
        }
        if (page.nextPageB && !pageNumbers.has(page.nextPageB)) {
          const msg = `Page ${page.pageNumber}: nextPageB=${page.nextPageB} does not exist`;
          validationErrors.push(msg);
        }
        if (!page.choiceA || !page.choiceB) {
          const msg = `Page ${page.pageNumber}: branch page missing choiceA or choiceB text`;
          validationErrors.push(msg);
        }
        // Track target references for merge detection
        if (page.nextPageA) {
          const refs = targetRefCount.get(page.nextPageA) ?? [];
          refs.push(page.pageNumber);
          targetRefCount.set(page.nextPageA, refs);
        }
        if (page.nextPageB) {
          const refs = targetRefCount.get(page.nextPageB) ?? [];
          refs.push(page.pageNumber);
          targetRefCount.set(page.nextPageB, refs);
        }
      }
    }

    // GUARDRAIL 1: Detect any page node referenced by more than one branch source (merge violation).
    // These are non-critical: the auto-repair loop below resolves them by clearing the duplicate
    // reference and downgrading the now-targetless page to an ending page.
    const mergeViolations: string[] = [];
    for (const [targetId, sourceIds] of Array.from(targetRefCount.entries())) {
      if (sourceIds.length > 1) {
        const violation = `MERGE VIOLATION: Page ${targetId} is referenced as a branch target by multiple pages: [${sourceIds.join(", ")}]. Auto-repairing.`;
        mergeViolations.push(violation);
        validationErrors.push(violation);
        // NOTE: intentionally NOT pushed to criticalValidationErrors — let auto-repair handle it.
      }
    }
    // Check at least one ending exists
    const endingPages = storyData.pages.filter(
      p =>
        p.isEnding ||
        (!p.isBranchPage && !p.nextPageA && !p.nextPageB && p.pageNumber > 1)
    );
    if (endingPages.length === 0) {
      const msg = "No ending pages found  story has no conclusion";
      validationErrors.push(msg);
    }

    if (validationErrors.length > 0) {
      console.warn(`[Books][Post-structure validation] detected violations`, {
        bookId,
        violations: validationErrors,
      });
      // Non-fatal violations are logged and can still be auto-repaired below.
    }

    if (mergeViolations.length > 0) {
      console.warn(
        `[Books][Post-structure validation] merge violations detected — routing to auto-repair`,
        {
          bookId,
          violations: mergeViolations,
        }
      );
    }

    // Auto-repair common non-critical structure issues instead of hard-failing generation.
    // Branch pages must always end with both A and B choices.
    const usedTargets = new Set<number>();
    for (const page of storyData.pages) {
      // Drop dangling references
      if (page.nextPageA && !pageNumbers.has(page.nextPageA)) {
        repairActions.push(
          `Page ${page.pageNumber}: cleared dangling nextPageA=${page.nextPageA}`
        );
        page.nextPageA = null;
      }
      if (page.nextPageB && !pageNumbers.has(page.nextPageB)) {
        repairActions.push(
          `Page ${page.pageNumber}: cleared dangling nextPageB=${page.nextPageB}`
        );
        page.nextPageB = null;
      }

      // Enforce no-merge by keeping the first reference to each target.
      if (page.nextPageA) {
        if (usedTargets.has(page.nextPageA)) {
          repairActions.push(
            `Page ${page.pageNumber}: cleared duplicate nextPageA target=${page.nextPageA}`
          );
          page.nextPageA = null;
          page.choiceA = null;
        } else usedTargets.add(page.nextPageA);
      }
      if (page.nextPageB) {
        if (usedTargets.has(page.nextPageB)) {
          repairActions.push(
            `Page ${page.pageNumber}: cleared duplicate nextPageB target=${page.nextPageB}`
          );
          page.nextPageB = null;
          page.choiceB = null;
        } else usedTargets.add(page.nextPageB);
      }

      const hasBranchTargets = !!(page.nextPageA || page.nextPageB);
      if (page.isBranchPage && hasBranchTargets) {
        if (!page.choiceA && page.nextPageA) {
          repairActions.push(
            `Page ${page.pageNumber}: backfilled missing choiceA`
          );
          page.choiceA = localizedChoiceFallbacks.optionA;
        }
        if (!page.choiceB && page.nextPageB) {
          repairActions.push(
            `Page ${page.pageNumber}: backfilled missing choiceB`
          );
          page.choiceB = localizedChoiceFallbacks.optionB;
        }

        if (
          page.choiceA &&
          page.nextPageA &&
          !page.choiceB &&
          !page.nextPageB
        ) {
          const candidate = storyData.pages.find(
            p =>
              p.pageNumber > page.pageNumber && !usedTargets.has(p.pageNumber)
          );
          if (candidate) {
            page.nextPageB = candidate.pageNumber;
            page.choiceB = localizedChoiceFallbacks.tryDifferent;
            usedTargets.add(candidate.pageNumber);
            repairActions.push(
              `Page ${page.pageNumber}: synthesised missing choiceB -> page ${candidate.pageNumber}`
            );
          } else {
            page.choiceB = localizedChoiceFallbacks.reconsider;
            page.nextPageB = page.nextPageA;
            repairActions.push(
              `Page ${page.pageNumber}: synthesised choiceB fallback (mirrors A target)`
            );
          }
        }

        if (
          page.choiceB &&
          page.nextPageB &&
          !page.choiceA &&
          !page.nextPageA
        ) {
          const candidate = storyData.pages.find(
            p =>
              p.pageNumber > page.pageNumber && !usedTargets.has(p.pageNumber)
          );
          if (candidate) {
            page.nextPageA = candidate.pageNumber;
            page.choiceA = localizedChoiceFallbacks.proceed;
            usedTargets.add(candidate.pageNumber);
            repairActions.push(
              `Page ${page.pageNumber}: synthesised missing choiceA -> page ${candidate.pageNumber}`
            );
          } else {
            page.choiceA = localizedChoiceFallbacks.faceDirectly;
            page.nextPageA = page.nextPageB;
            repairActions.push(
              `Page ${page.pageNumber}: synthesised choiceA fallback (mirrors B target)`
            );
          }
        }
      }

      // If no valid targets remain, downgrade to non-branch ending page.
      const hasBranchTargetsNow = !!(page.nextPageA || page.nextPageB);
      if (!hasBranchTargetsNow) {
        const needsDowngradeMutation =
          page.isBranchPage ||
          page.choiceA !== null ||
          page.choiceB !== null ||
          page.nextPageA !== null ||
          page.nextPageB !== null ||
          !page.isEnding;

        if (needsDowngradeMutation) {
          repairActions.push(
            `Page ${page.pageNumber}: downgraded to ending page due to missing branch targets`
          );
          page.isBranchPage = false;
          page.choiceA = null;
          page.choiceB = null;
          page.nextPageA = null;
          page.nextPageB = null;
          page.isEnding = true;
        }
      }
    }

    // GUARDRAIL 3: No consecutive branch pages — a branch target must not itself be a branch page.
    // Demote any such target page to a narrative (non-branch) page.
    {
      const pageByNum = new Map(storyData.pages.map(p => [p.pageNumber, p]));
      for (const page of storyData.pages) {
        if (!page.isBranchPage) continue;
        for (const targetNum of [page.nextPageA, page.nextPageB]) {
          if (!targetNum) continue;
          const targetPage = pageByNum.get(targetNum);
          if (targetPage && targetPage.isBranchPage) {
            repairActions.push(
              `Page ${targetPage.pageNumber}: demoted from branch to narrative (was direct target of branch page ${page.pageNumber})`
            );
            targetPage.isBranchPage = false;
            targetPage.choiceA = null;
            targetPage.choiceB = null;
            targetPage.nextPageA = null;
            targetPage.nextPageB = null;
          }
        }
      }
    }

    const repairedEndingPages = storyData.pages.filter(
      p => p.isEnding || (!p.isBranchPage && !p.nextPageA && !p.nextPageB)
    );
    if (repairedEndingPages.length === 0 && storyData.pages.length > 0) {
      const last = storyData.pages[storyData.pages.length - 1];
      last.isBranchPage = false;
      last.choiceA = null;
      last.choiceB = null;
      last.nextPageA = null;
      last.nextPageB = null;
      last.isEnding = true;
      validationErrors.push("Auto-repair: forced final page to ending.");
      repairActions.push(
        `Page ${last.pageNumber}: forced final page to ending`
      );
    }

    console.info(`[Books][Post-structure validation] applied repair actions`, {
      bookId,
      actions: repairActions,
    });
    console.info(`[Books][Post-structure validation] final structure status`, {
      bookId,
      status:
        repairActions.length > 0 || validationErrors.length > 0
          ? "repaired"
          : "clean",
    });

    storyData.pages = storyData.pages.map(page => ({
      ...page,
      choiceA: translateGenericChoiceFallback(page.choiceA, language, "A"),
      choiceB: translateGenericChoiceFallback(page.choiceB, language, "B"),
    }));

    // Step 4: Per-page expansion pass
    // For non-comic categories, enrich each page's content with a dedicated
    // LLM call that injects: character cards + the last 3 pages of context.
    // GUARDRAIL 2: Rolling context is branch-safe  only pages from the same
    // branchPath lineage are used. Pages from other branches are never injected.
    // Feature A: Fairy tale expansion pass (lightweight, child-appropriate language)
    if (category === "fairy_tale") {
      const fairyExpandedByPageNum = new Map<number, string>();
      const fairyParentMap = new Map<number, number>();
      for (const p of storyData.pages) {
        if (p.nextPageA) fairyParentMap.set(p.nextPageA, p.pageNumber);
        if (p.nextPageB) fairyParentMap.set(p.nextPageB, p.pageNumber);
      }
      const getFairyAncestors = (pageNum: number, limit: number): number[] => {
        const ancestors: number[] = [];
        let current = fairyParentMap.get(pageNum);
        while (current !== undefined && ancestors.length < limit) {
          ancestors.unshift(current);
          current = fairyParentMap.get(current);
        }
        return ancestors.slice(-limit);
      };

      for (let i = 0; i < storyData.pages.length; i++) {
        const page = storyData.pages[i];
        await db
          .update(books)
          .set({
            generationStep: `Writing page ${i + 1} of ${storyData.pages.length}…`,
          })
          .where(eq(books.id, bookId));
        const ancestorNums = getFairyAncestors(page.pageNumber, 3);
        const branchSafeContext = ancestorNums
          .map(num => fairyExpandedByPageNum.get(num))
          .filter((c): c is string => !!c)
          .join(
            ". For ending pages use calm ambient sounds (gentle-wind, sunset, peaceful) - NO cheering, applause, celebration or fanfare\n\n---\n\n"
          );
        const contextBlock = branchSafeContext
          ? `\n\nSTORY SO FAR (last ${ancestorNums.length} pages on this branch path):\n${branchSafeContext}`
          : "";
        const otherParentPageNum = fairyParentMap.get(page.pageNumber);
        const otherParentPage = otherParentPageNum
          ? storyData.pages.find(p => p.pageNumber === otherParentPageNum)
          : null;
        const otherChoiceTaken = otherParentPage
          ? otherParentPage.nextPageA === page.pageNumber
            ? otherParentPage.choiceA
            : otherParentPage.choiceB
          : null;
        const branchContext =
          page.branchPath && page.branchPath !== "root"
            ? `\n\nBRANCH CONTEXT: This page is on the "${page.branchPath}" path. The reader chose: "${otherChoiceTaken || page.branchPath}". The narrative must directly continue from and reflect that choice.`
            : "";
        try {
          const expandResp = await invokeLLM({
            messages: [
              {
                role: "system" as const,
                content: `You are a warm, imaginative children's book author writing in ${language}. Expand the given page outline into a short, magical fairy tale passage suitable for children aged 4-10.${characterCardBlock}

CHILDREN'S WRITING RULES:
- Use simple, clear vocabulary that children can understand
- Keep sentences short and rhythmic (2-3 sentences per paragraph)
- Use vivid, sensory details: colours, sounds, smells, textures
- Maintain a warm, hopeful, and whimsical tone throughout
- Characters must match their descriptions exactly  no aliases
- Every new page must introduce a NEW concrete beat, discovery, obstacle, decision, or emotional turn. Do not merely restate the previous page's wonder.
- Avoid repetitive exclamations, repeated parent-child call-and-response, and generic filler lines. Dialogue and narration should feel fresh from page to page.
- If a vehicle, journey, or magical setting has already been established, show visible progress or a changed situation instead of repeating the same scene description.
- If this is page 1 (the very first page of the story), write a proper OPENING that introduces the main characters, sets the scene, and establishes the world. The reader must feel this is the clear beginning of a brand-new adventure.
- If this is NOT page 1, NEVER restart the story, never reintroduce the cast from scratch, and never repeat the opening premise. Continue the immediate action already in progress.
- If this page follows a branch choice, make the chosen consequence explicit and materially different from the unchosen route.
- If this is a branch page, keep the narrative open-ended and let UI buttons show choices (do not print A/B labels inside prose)${contextBlock}${branchContext}`,
              },
              {
                role: "user" as const,
                content: `Expand this fairy tale page outline into 1-2 short, magical paragraphs in ${language} (suitable for children):

Page ${page.pageNumber} outline: ${page.content}${page.isBranchPage ? `\n\nThis is a choice page. Keep prose natural and DO NOT print "Choice A" or "Choice B" inside the story text.` : ""}${page.isEnding ? "\n\nThis is an ending page. Write a warm, satisfying conclusion that feels complete and hopeful." : ""}

Write ONLY the narrative prose  no JSON, no page numbers, no labels.`,
              },
            ],
          });
          const expanded = expandResp.choices[0]?.message?.content;
          if (typeof expanded === "string" && expanded.trim().length > 30) {
            storyData.pages[i].content = expanded.trim();
            fairyExpandedByPageNum.set(page.pageNumber, expanded.trim());
          } else {
            fairyExpandedByPageNum.set(page.pageNumber, page.content);
          }
        } catch (expandErr) {
          console.error(
            `[Books] Fairy tale page ${page.pageNumber} expansion failed, using outline:`,
            expandErr
          );
          fairyExpandedByPageNum.set(page.pageNumber, page.content);
        }
      }
    }

    if (isComic) {
      const comicExpandedByPageNum = new Map<number, string>();
      const comicParentMap = new Map<number, number>();
      for (const p of storyData.pages) {
        if (p.nextPageA) comicParentMap.set(p.nextPageA, p.pageNumber);
        if (p.nextPageB) comicParentMap.set(p.nextPageB, p.pageNumber);
      }

      const getComicAncestors = (pageNum: number, limit: number): number[] => {
        const ancestors: number[] = [];
        let current = comicParentMap.get(pageNum);
        while (current !== undefined && ancestors.length < limit) {
          ancestors.unshift(current);
          current = comicParentMap.get(current);
        }
        return ancestors.slice(-limit);
      };

      for (let i = 0; i < storyData.pages.length; i++) {
        const page = storyData.pages[i];
        await db
          .update(books)
          .set({
            generationStep: `Writing comic page ${i + 1} of ${storyData.pages.length}…`,
          })
          .where(eq(books.id, bookId));

        const ancestorNums = getComicAncestors(page.pageNumber, 3);
        const branchSafeContext = ancestorNums
          .map(num => comicExpandedByPageNum.get(num))
          .filter((content): content is string => !!content)
          .join("\n\n---\n\n");
        const contextBlock = branchSafeContext
          ? `\n\nSTORY SO FAR (last ${ancestorNums.length} pages on this branch path):\n${branchSafeContext}`
          : "";

        const parentPageNum = comicParentMap.get(page.pageNumber);
        const parentPage = parentPageNum
          ? storyData.pages.find(
              candidate => candidate.pageNumber === parentPageNum
            )
          : null;
        const chosenBranchLabel = parentPage
          ? parentPage.nextPageA === page.pageNumber
            ? parentPage.choiceA
            : parentPage.choiceB
          : null;
        const branchContext =
          page.branchPath && page.branchPath !== "root"
            ? `\n\nBRANCH CONTEXT: This page is on branch "${page.branchPath}". The reader chose "${chosenBranchLabel || page.branchPath}" to get here. The consequence of that choice must be visible in the action, stakes, and environment.`
            : "";

        try {
          const expandResp = await invokeLLM({
            messages: [
              {
                role: "system" as const,
                content: `You are a veteran comic-book writer scripting a ${category.replace(/_/g, " ")} interactive comic in ${language}.${characterCardBlock}

COMIC PAGE WRITING RULES:
- Rewrite each page into a compact synopsis that can be split into EXACTLY 3 consecutive comic panels.
- The page must contain a clear three-beat escalation: setup, confrontation, consequence.
- Use concrete action, changing staging, and cause/effect progression. Avoid static mood-only description.
- Avoid repetitive filler lines and empty urgency phrases. Every sentence must advance plot, reveal character, or sharpen conflict.
- Spoken dialogue should only exist when a character is audibly addressing another character, a group, or an enemy. Internal thoughts, hesitation, and solo self-talk should stay in scene narration/status-box material instead.
- Most pages should include interaction with another person, creature, crowd, or opposing force. If the protagonist is alone, the environment itself must actively pressure them.
- If this is page 1, write a true opening scene. If this is not page 1, continue the existing action without restarting the premise.
- If this is a branch page, end with a vivid unresolved dilemma and let the UI buttons carry the actual A/B options.${contextBlock}${branchContext}

UNICODE RULE (MANDATORY): NEVER strip, normalize, or replace special characters. Preserve ALL Unicode exactly as written in ${language}.`,
              },
              {
                role: "user" as const,
                content: `Rewrite this comic page outline in ${language} as a compact 3-beat comic-page synopsis:

Page ${page.pageNumber} outline: ${page.content}${page.isBranchPage ? `\n\nThis is a choice page. Keep the prose open-ended and DO NOT print "Choice A" or "Choice B" inside the story text.` : ""}${page.isEnding ? "\n\nThis is an ending page. The third beat must land as a satisfying final image or decisive outcome." : ""}

Write ONLY prose in ${language}. Use either exactly 3 short sentences or 1 short paragraph that clearly implies 3 consecutive panels. Do not label panel numbers.`,
              },
            ],
          });

          const expanded = expandResp.choices[0]?.message?.content;
          if (typeof expanded === "string" && expanded.trim().length > 40) {
            storyData.pages[i].content = expanded.trim();
            comicExpandedByPageNum.set(page.pageNumber, expanded.trim());
          } else {
            comicExpandedByPageNum.set(page.pageNumber, page.content);
          }
        } catch (expandErr) {
          console.error(
            `[Books] Comic page ${page.pageNumber} expansion failed, using outline:`,
            expandErr
          );
          comicExpandedByPageNum.set(page.pageNumber, page.content);
        }
      }
    }

    if (!isComic && category !== "fairy_tale") {
      // Map: pageNumber  expanded content (for branch-safe context lookup)
      const expandedByPageNum = new Map<number, string>();

      // Build a parent map: pageNumber  parentPageNumber (via nextPageA/nextPageB)
      // This lets us walk up the lineage to find ancestors on the same branch path.
      const parentMap = new Map<number, number>();
      for (const p of storyData.pages) {
        if (p.nextPageA) parentMap.set(p.nextPageA, p.pageNumber);
        if (p.nextPageB) parentMap.set(p.nextPageB, p.pageNumber);
      }

      // Walk up the parent chain to get the last N ancestors of a given page.
      const getBranchAncestors = (pageNum: number, limit: number): number[] => {
        const ancestors: number[] = [];
        let current = parentMap.get(pageNum);
        while (current !== undefined && ancestors.length < limit) {
          ancestors.unshift(current);
          current = parentMap.get(current);
        }
        return ancestors.slice(-limit); // keep only the last `limit` ancestors
      };

      for (let i = 0; i < storyData.pages.length; i++) {
        const page = storyData.pages[i];
        await db
          .update(books)
          .set({
            generationStep: `Writing page ${i + 1} of ${storyData.pages.length}…`,
          })
          .where(eq(books.id, bookId));

        // GUARDRAIL 2: Build rolling context from the last 3 pages on THIS branch path only.
        // We walk up the parent chain to find ancestors, then look up their expanded content.
        const ancestorNums = getBranchAncestors(page.pageNumber, 3);
        const branchSafeContext = ancestorNums
          .map(num => expandedByPageNum.get(num))
          .filter((c): c is string => !!c)
          .join("\n\n---\n\n");

        console.log(
          `[Books] GUARDRAIL 2  Branch-safe context for page ${page.pageNumber} (path: ${page.branchPath}): ` +
            `using ancestors [${ancestorNums.join(", ")}] (${branchSafeContext ? branchSafeContext.length : 0} chars)`
        );

        const contextBlock = branchSafeContext
          ? `\n\nSTORY SO FAR (last ${ancestorNums.length} pages on this branch path):\n${branchSafeContext}`
          : "";

        // Build branch context if this page follows a choice
        const parentPageNum = parentMap.get(page.pageNumber);
        const parentPage = parentPageNum
          ? storyData.pages.find(
              candidate => candidate.pageNumber === parentPageNum
            )
          : null;
        const chosenBranchLabel = parentPage
          ? parentPage.nextPageA === page.pageNumber
            ? parentPage.choiceA
            : parentPage.choiceB
          : null;
        const branchContext =
          page.branchPath && page.branchPath !== "root"
            ? `\n\nBRANCH CONTEXT: This page is on the "${page.branchPath}" path. The reader chose "${chosenBranchLabel || page.branchPath}" to arrive here. The prose must show a materially different consequence from the unchosen branch.`
            : "";

        try {
          const expandResp = await invokeLLM({
            messages: [
              {
                role: "system" as const,
                content: `You are a skilled ${category.replace(/_/g, " ")} author writing in ${language}. Expand the given page outline into rich, immersive prose.${characterCardBlock}

CONTINUITY RULES:
- Use character names exactly as in the character cards  no aliases or nickname variations
- Character appearances and personalities must match the character cards exactly
- Do NOT introduce new named characters without establishing them
- Maintain consistent tone and atmosphere for ${category.replace(/_/g, " ")} genre
- If this is a branch page, keep the narrative open-ended and let UI buttons show choices (do not print A/B labels inside prose)${contextBlock}${branchContext}
- If this is page 1 (the very first page of the story), write a proper OPENING that introduces the main characters, sets the scene, and establishes the world. The reader must feel this is the clear beginning of a brand-new adventure.

UNICODE RULE (MANDATORY): NEVER strip, normalize, or replace special characters. Preserve ALL Unicode exactly as written  Turkish (c-cedilla, g-breve, dotless-i, o-umlaut, s-cedilla, u-umlaut), German (umlauts, sharp-s), French accents, Spanish tilde-n, Cyrillic, Chinese, Japanese, Arabic, and all other scripts must appear verbatim.`,
              },
              {
                role: "user" as const,
                content: `Expand this page outline into 2-4 vivid paragraphs of narrative prose in ${language}:

Page ${page.pageNumber} outline: ${page.content}${page.isBranchPage ? `\n\nThis is a choice page. Keep prose natural and DO NOT print "Choice A" or "Choice B" inside the story text.` : ""}${page.isEnding ? "\n\nThis is an ending page. Write a satisfying conclusion." : ""}

Write ONLY the narrative prose  no JSON, no page numbers, no labels.`,
              },
            ],
          });

          const expanded = expandResp.choices[0]?.message?.content;
          if (typeof expanded === "string" && expanded.trim().length > 50) {
            storyData.pages[i].content = expanded.trim();
            expandedByPageNum.set(page.pageNumber, expanded.trim());
          } else {
            expandedByPageNum.set(page.pageNumber, page.content);
          }
        } catch (expandErr) {
          console.error(
            `[Books] Page ${page.pageNumber} expansion failed, using outline:`,
            expandErr
          );
          expandedByPageNum.set(page.pageNumber, page.content);
        }
      }
    }

    // Final prose cleanup: strip duplicated in-text choice labels and UI-like markers.
    storyData.pages = storyData.pages.map(page => ({
      ...page,
      content: stripInlineChoiceLabels(page.content ?? ""),
    }));

    const plannedIllustratedPageNumbers = new Set<number>(
      isOtherGenre
        ? storyData.pages
            .filter(page => page.isBranchPage)
            .slice(0, branchImageCount)
            .map(page => page.pageNumber)
        : storyData.pages.map(page => page.pageNumber)
    );

    let recurringObjects: RecurringObjectProfile[] = [];
    try {
      const objectRegistryResponse = await invokeLLM({
        messages: [
          {
            role: "system" as const,
            content:
              "You are a visual continuity supervisor. Return valid JSON only. Identify only recurring non-character objects that need a locked visual identity across scenes.",
          },
          {
            role: "user" as const,
            content: `Analyse this gamebook and extract recurring visual objects that must keep the same design across pages.

Characters:
${canonicalCharacterProfiles.map(profile => `- ${profile.name}: ${profile.appearance}`).join("\n")}

Story pages:
${storyData.pages
  .map(
    page =>
      `Page ${page.pageNumber} (${page.branchPath}): ${page.content.slice(0, 220)}`
  )
  .join("\n")}

Return JSON:
{"objects":[{"name":"","canonicalAppearance":"","invariants":[""],"continuityRole":"","firstSeenPage":1}]}

Rules:
- Include only objects or vehicles that recur or obviously must stay consistent.
- Never include people.
- Be concrete about shape, colours, materials, and proportions.
- If nothing qualifies, return {"objects":[]}.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const rawObjects =
        objectRegistryResponse.choices[0]?.message?.content || '{"objects":[]}';
      const objectPayload =
        typeof rawObjects === "string"
          ? rawObjects.trim()
          : JSON.stringify(rawObjects);
      if (objectPayload.startsWith("{")) {
        const parsedObjects = JSON.parse(repairJSON(objectPayload));
        if (Array.isArray(parsedObjects.objects)) {
          recurringObjects = parsedObjects.objects
            .map((item: any) => ({
              name: String(item?.name ?? "").trim(),
              canonicalAppearance: String(
                item?.canonicalAppearance ?? ""
              ).trim(),
              invariants: Array.isArray(item?.invariants)
                ? item.invariants
                    .map((value: unknown) => String(value).trim())
                    .filter(Boolean)
                : [],
              continuityRole: item?.continuityRole
                ? String(item.continuityRole).trim()
                : undefined,
              firstSeenPage: item?.firstSeenPage
                ? Number(item.firstSeenPage)
                : undefined,
            }))
            .filter(
              (item: RecurringObjectProfile) =>
                item.name && item.canonicalAppearance
            );
        }
      }
    } catch (objectErr) {
      console.warn(
        "[Books] Recurring object registry generation failed; continuing without locked object registry.",
        objectErr
      );
    }

    const visualBlueprint = createBookVisualBlueprint({
      readablePathLength: pageCount,
      graphPageCount,
      styleLock: STYLE_LOCK,
      characterProfiles: canonicalCharacterProfiles,
      recurringObjects,
    });
    const portraitReferenceMap = new Map(
      Array.from(illustratedPortraitsMap.entries()).map(([name, ref]) => [
        name,
        { url: ref.url, mimeType: ref.mimeType },
      ])
    );

    const findMentionedCharacters = (content: string) =>
      canonicalCharacterProfiles
        .filter(profile =>
          new RegExp(
            `\\b${profile.name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`,
            "i"
          ).test(content)
        )
        .map(profile => profile.name);

    const findMentionedObjects = (content: string) =>
      recurringObjects
        .filter(object =>
          new RegExp(
            `\\b${object.name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`,
            "i"
          ).test(content)
        )
        .map(object => object.name);

    const parentPageMap = new Map<number, number>();
    for (const page of storyData.pages) {
      if (page.nextPageA) parentPageMap.set(page.nextPageA, page.pageNumber);
      if (page.nextPageB) parentPageMap.set(page.nextPageB, page.pageNumber);
    }

    const sceneSpecsByPageNumber = new Map<number, SceneSpec>();
    for (const page of storyData.pages) {
      if (!plannedIllustratedPageNumbers.has(page.pageNumber)) continue;

      const parentPageNumber = parentPageMap.get(page.pageNumber);
      const previousScene = parentPageNumber
        ? sceneSpecsByPageNumber.get(parentPageNumber)
        : undefined;
      const fallbackScene = sceneSpecFallback({
        pageNumber: page.pageNumber,
        narrative: page.content,
        previousScene,
        blueprint: visualBlueprint,
      });

      const mentionedCharacters = findMentionedCharacters(page.content);
      const mentionedObjects = findMentionedObjects(page.content);

      try {
        const parentPage = parentPageNumber
          ? storyData.pages.find(
              candidate => candidate.pageNumber === parentPageNumber
            )
          : undefined;
        const branchChoice =
          parentPage && parentPage.isBranchPage
            ? parentPage.nextPageA === page.pageNumber
              ? parentPage.choiceA
              : parentPage.choiceB
            : null;

        const sceneSpecResponse = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content:
                "You are a storyboard continuity director. Return valid JSON only. Produce a scene specification that can be rendered directly without reinterpreting characters, objects, or continuity.",
            },
            {
              role: "user" as const,
              content: `Create a structured scene specification for page ${page.pageNumber}.

Page narrative:
${page.content}

Canonical characters:
${canonicalCharacterProfiles.map(profile => `- ${profile.promptBlock}`).join("\n")}

Recurring objects:
${recurringObjects.map(object => `- ${object.name}: ${object.canonicalAppearance}. Invariants: ${object.invariants.join(", ")}`).join("\n") || "- none"}

Previous illustrated scene:
${previousScene ? JSON.stringify(previousScene) : "none"}

Branch consequence:
${branchChoice || "continue the currently active branch faithfully"}

Mentioned characters: ${mentionedCharacters.join(", ") || "none explicitly named"}
Mentioned objects: ${mentionedObjects.join(", ") || "none explicitly named"}

Return JSON:
{
  "pageNumber": ${page.pageNumber},
  "sceneSummary": "",
  "narrativeBeat": "",
  "location": "",
  "environment": "",
  "timeOfDay": "",
  "lighting": "",
  "physics": "",
  "camera": "",
  "composition": "",
  "continuityFromPrevious": "",
  "branchDelta": "",
  "mustShow": ["", ""],
  "explicitExclusions": ["text", "captions"],
  "characters": [{"name":"","action":"","pose":"","framing":"","visibility":""}],
  "recurringObjects": [{"name":"","state":"","visibility":""}]
}

Rules:
- Keep character identity, age, outfit, and facial structure invariant.
- If a recurring object appears, keep its canonical design invariant.
- Make branch consequences visually explicit.
- Enforce physically consistent lighting and environment continuity unless the story clearly changes them.
- Guarantee stable framing with fully visible primary subjects.
- Never include text in the image.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });

        const rawScene = sceneSpecResponse.choices[0]?.message?.content || "{}";
        const parsedScene = parseSceneSpecResponse(
          typeof rawScene === "string" ? rawScene : JSON.stringify(rawScene),
          {
            ...fallbackScene,
            characters: mentionedCharacters.map(name => ({
              name,
              action: "present in the scene",
              pose: "natural story pose",
              framing: "fully visible",
              visibility: "fully visible",
            })),
            recurringObjects: mentionedObjects.map(name => ({
              name,
              state: "present and unchanged",
              visibility: "visible",
            })),
          }
        );
        sceneSpecsByPageNumber.set(page.pageNumber, parsedScene);
      } catch (sceneErr) {
        sceneSpecsByPageNumber.set(page.pageNumber, {
          ...fallbackScene,
          characters: mentionedCharacters.map(name => ({
            name,
            action: "present in the scene",
            pose: "natural story pose",
            framing: "fully visible",
            visibility: "fully visible",
          })),
          recurringObjects: mentionedObjects.map(name => ({
            name,
            state: "present and unchanged",
            visibility: "visible",
          })),
        });
        console.warn(
          `[Books] Scene spec generation failed for page ${page.pageNumber}; using fallback continuity spec.`,
          sceneErr
        );
      }
    }

    for (const page of storyData.pages) {
      if (!page.isBranchPage || !page.nextPageA || !page.nextPageB) continue;
      const nextA = storyData.pages.find(
        candidate => candidate.pageNumber === page.nextPageA
      );
      const nextB = storyData.pages.find(
        candidate => candidate.pageNumber === page.nextPageB
      );
      if (!nextA || !nextB) continue;

      const similarity = branchSimilarityScore(nextA.content, nextB.content);
      if (similarity > 0.6) {
        page.choiceA = page.choiceA || localizedChoiceFallbacks.optionA;
        page.choiceB = page.choiceB || localizedChoiceFallbacks.optionB;
        const spec = sceneSpecsByPageNumber.get(page.pageNumber);
        if (spec) {
          spec.branchDelta = `Show a visibly different outcome for "${page.choiceA}" versus "${page.choiceB}". The two branches currently risk looking too similar and must diverge in action, environment, and mood.`;
          sceneSpecsByPageNumber.set(page.pageNumber, spec);
        }
      }
    }

    await db
      .update(books)
      .set({ generationStep: "Generating cover image…" })
      .where(eq(books.id, bookId));

    type IllustrationRecurringObjectProfile = {
      id: string;
      name: string;
      canonicalAppearance: string;
      continuityRules: string[];
      traitsToAvoidChanging: string[];
      introducedOnPage: number | null;
      requiredPageNumbers: number[];
    };

    type IllustrationSceneSpec = {
      pageNumber: number;
      location: string;
      mainAction: string;
      emotionalTone: string;
      requiredObjects: string[];
      forbiddenObjects: string[];
      cameraFraming: string;
      continuityRequirementsFromPreviousPage: string[];
      featuredCharacters: string[];
      actionMoments: string[];
    };

    const branchPageNumbers = new Set<number>(
      storyData.pages
        .filter(p => p.isBranchPage)
        .slice(0, branchImageCount)
        .map(p => p.pageNumber)
    );

    const shouldIllustratePage = (pageNumber: number): boolean => {
      if (isComic || category === "fairy_tale") return true;
      return branchPageNumbers.has(pageNumber);
    };

    const illustratedStoryPages = storyData.pages.filter(page =>
      shouldIllustratePage(page.pageNumber)
    );
    const extractMentionedCharactersFromText = (text: string): string[] => {
      const matches = canonicalCharacterProfiles
        .filter(profile =>
          new RegExp(
            `\\b${profile.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i"
          ).test(text)
        )
        .map(profile => profile.name);
      return matches.length > 0
        ? matches
        : canonicalCharacterProfiles.map(profile => profile.name);
    };

    const keywordSeeds = [
      "rocket",
      "backpack",
      "map",
      "helmet",
      "lantern",
      "key",
      "book",
      "sword",
      "wand",
      "ship",
      "spaceship",
    ];
    const fallbackRecurringObjects =
      (): IllustrationRecurringObjectProfile[] => {
        const detected: IllustrationRecurringObjectProfile[] = [];
        for (const keyword of keywordSeeds) {
          const relatedPages = storyData.pages.filter(page => {
            const sourceText =
              `${page.outlineContent ?? ""} ${page.content ?? ""}`.toLowerCase();
            return sourceText.includes(keyword.toLowerCase());
          });
          if (relatedPages.length >= 1) {
            detected.push({
              id: keyword.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
              name: keyword,
              canonicalAppearance: `the same ${keyword} design established earlier in the book`,
              continuityRules: [
                `if the ${keyword} appears again, keep its silhouette, colours, and material details consistent`,
              ],
              traitsToAvoidChanging: [
                `do not redesign or recolor the ${keyword}`,
                `do not omit the ${keyword} when the story references it`,
              ],
              introducedOnPage: relatedPages[0]?.pageNumber ?? null,
              requiredPageNumbers: relatedPages.map(page => page.pageNumber),
            });
          }
        }
        return detected;
      };

    let recurringObjectMemory: IllustrationRecurringObjectProfile[] =
      fallbackRecurringObjects();
    if (illustratedStoryPages.length > 0) {
      try {
        const objectResp = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content:
                "You extract recurring visual continuity objects for illustrated stories. Return valid JSON only.",
            },
            {
              role: "user" as const,
              content: `Identify recurring visual objects or assets that should remain stable across this book. Focus on items such as rocket, backpack, map, signature tools, vehicles, magical objects, or clearly repeated props.

Return JSON:
{"objects":[{"id":"","name":"","canonicalAppearance":"","continuityRules":[""],"traitsToAvoidChanging":[""],"introducedOnPage":1,"requiredPageNumbers":[1,2]}]}

Rules:
- Include an object only if it is narratively important or repeated.
- canonicalAppearance must define what should stay visually stable.
- traitsToAvoidChanging should mention the most likely drift problems.
- requiredPageNumbers should include the pages where the object is explicitly needed.

PAGES:
${illustratedStoryPages.map(page => `Page ${page.pageNumber}: ${(page.outlineContent ?? page.content).slice(0, 260)}`).join("\n")}`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 8000,
        });
        const objectRaw = objectResp.choices[0]?.message?.content || "{}";
        const objectPayload =
          typeof objectRaw === "string"
            ? objectRaw.trim()
            : JSON.stringify(objectRaw);
        if (objectPayload.startsWith("{")) {
          const objectParsed = JSON.parse(repairJSON(objectPayload));
          if (
            Array.isArray(objectParsed.objects) &&
            objectParsed.objects.length > 0
          ) {
            recurringObjectMemory = objectParsed.objects.map(
              (obj: IllustrationRecurringObjectProfile) => ({
                ...obj,
                continuityRules: compactList(obj.continuityRules),
                traitsToAvoidChanging: compactList(obj.traitsToAvoidChanging),
                requiredPageNumbers: Array.from(
                  new Set(
                    (obj.requiredPageNumbers ?? []).filter((num: number) =>
                      Number.isFinite(num)
                    )
                  )
                ),
                introducedOnPage: Number.isFinite(obj.introducedOnPage)
                  ? obj.introducedOnPage
                  : null,
              })
            );
          }
        }
      } catch (objectErr) {
        console.warn(
          "[Books] Recurring object continuity extraction failed, using keyword-based fallback:",
          objectErr
        );
      }
    }

    const recurringObjectsByPage = new Map<
      number,
      IllustrationRecurringObjectProfile[]
    >();
    for (const objectProfile of recurringObjectMemory) {
      for (const pageNumber of objectProfile.requiredPageNumbers) {
        const existing = recurringObjectsByPage.get(pageNumber) ?? [];
        recurringObjectsByPage.set(pageNumber, [...existing, objectProfile]);
      }
    }

    const fallbackSceneSpec = (
      page: StoryData["pages"][number],
      previousPage?: StoryData["pages"][number]
    ): IllustrationSceneSpec => {
      const sourceText =
        `${page.outlineContent ?? page.content} ${page.content}`.trim();
      const requiredObjects = (
        recurringObjectsByPage.get(page.pageNumber) ?? []
      ).map(objectProfile => objectProfile.name);
      return {
        pageNumber: page.pageNumber,
        location: page.isEnding
          ? "final story location from the text"
          : "location described in the page text",
        mainAction: sourceText.slice(0, 180),
        emotionalTone: page.isEnding
          ? "resolved and emotionally complete"
          : page.isBranchPage
            ? "tense decision moment"
            : "story-specific emotional tone from the page text",
        requiredObjects,
        forbiddenObjects: ["random text", "unexplained extra props"],
        cameraFraming: isComic
          ? "dynamic comic composition matching the action"
          : page.isBranchPage
            ? "clear dramatic decision framing"
            : "storybook framing focused on the page action",
        continuityRequirementsFromPreviousPage: previousPage
          ? [
              `continue visual continuity from page ${previousPage.pageNumber}`,
              `preserve the same character identities, outfits, and props seen previously when still present`,
            ]
          : ["establish the canonical look cleanly on first appearance"],
        featuredCharacters: extractMentionedCharactersFromText(sourceText),
        actionMoments: [sourceText.slice(0, 140)],
      };
    };

    const NEGATIVE_PROMPT_GUARDRAILS = [
      "NEGATIVE GUARDRAILS: no hairstyle changes on later pages",
      "no age drift, no younger or older redesign",
      "no outfit redesign, no color swaps, no missing signature clothing",
      "no missing backpack, map, rocket, or other required recurring object when specified",
      "no random symbols, letters, words, numbers, logos, captions, watermarks, or background signage",
      "no extra unexplained props, duplicate characters, lookalikes, or blended faces",
      "no generic magical filler scene that ignores the page action",
      "no style drift, no switch in medium, line quality, palette, or rendering finish",
    ].join(" | ");

    const buildGlobalStyleLayer = () =>
      [
        "GLOBAL STYLE PROFILE",
        `medium: ${globalStyleProfile.medium}`,
        `lighting: ${globalStyleProfile.lighting}`,
        `palette: ${globalStyleProfile.palette}`,
        `linework: ${globalStyleProfile.linework}`,
        `composition: ${globalStyleProfile.composition}`,
        ...globalStyleProfile.renderingRules.map(
          rule => `rendering rule: ${rule}`
        ),
        ...globalStyleProfile.continuityRules.map(
          rule => `style continuity rule: ${rule}`
        ),
      ].join(" | ");

    const buildCanonicalCharacterLayer = (featuredNames?: string[]) => {
      const relevantProfiles =
        featuredNames && featuredNames.length > 0
          ? canonicalCharacterProfiles.filter(profile =>
              featuredNames.includes(profile.name)
            )
          : canonicalCharacterProfiles;
      return relevantProfiles.length > 0
        ? [
            "CANONICAL CHARACTER LAYER",
            ...relevantProfiles.map(formatCanonicalProfile),
            STRUCTURED_IDENTITY_BLOCK || undefined,
          ]
            .filter(Boolean)
            .join(" | ")
        : "";
    };

    const buildRecurringObjectLayer = (requiredObjects: string[]) => {
      const relevantObjects = recurringObjectMemory.filter(objectProfile =>
        requiredObjects.some(
          required =>
            required.toLowerCase().includes(objectProfile.name.toLowerCase()) ||
            objectProfile.name.toLowerCase().includes(required.toLowerCase())
        )
      );
      return relevantObjects.length > 0
        ? [
            "RECURRING OBJECT CONTINUITY MEMORY",
            ...relevantObjects.map(objectProfile =>
              [
                `${objectProfile.name}`,
                `canonical appearance=${objectProfile.canonicalAppearance}`,
                ...objectProfile.continuityRules.map(rule => `rule=${rule}`),
                ...objectProfile.traitsToAvoidChanging.map(
                  rule => `avoid=${rule}`
                ),
              ].join(" | ")
            ),
          ].join(" | ")
        : "";
    };

    const buildSceneSpecificLayer = (sceneSpec?: IllustrationSceneSpec) => {
      if (!sceneSpec) return "";
      return [
        "SCENE-SPECIFIC PROMPT SPEC",
        `location: ${sceneSpec.location}`,
        `main action: ${sceneSpec.mainAction}`,
        `emotional tone: ${sceneSpec.emotionalTone}`,
        `camera framing: ${sceneSpec.cameraFraming}`,
        `featured characters: ${sceneSpec.featuredCharacters.join(", ") || "none"}`,
        `required objects: ${sceneSpec.requiredObjects.join(", ") || "none"}`,
        `forbidden objects: ${sceneSpec.forbiddenObjects.join(", ") || "none"}`,
        ...sceneSpec.actionMoments.map(moment => `action beat: ${moment}`),
        ...sceneSpec.continuityRequirementsFromPreviousPage.map(
          requirement => `previous-page continuity: ${requirement}`
        ),
      ].join(" | ");
    };

    const buildContinuityConstraintLayer = (
      sceneSpec?: IllustrationSceneSpec
    ) =>
      [
        strictCategoryAwareIdentityInstruction,
        CHARACTER_COLOUR_LOCK,
        CHARACTER_LOCK_INSTRUCTION,
        sceneSpec?.requiredObjects?.length
          ? `MANDATORY OBJECT PRESENCE: show these exact recurring objects if story-relevant: ${sceneSpec.requiredObjects.join(", ")}`
          : "",
        sceneSpec?.forbiddenObjects?.length
          ? `FORBIDDEN VISUAL ELEMENTS: do not show ${sceneSpec.forbiddenObjects.join(", ")}`
          : "",
        "CHARACTER CONTINUITY: same face shape, hair, age impression, clothing design, and silhouette across the entire book",
        "NO LATE-PAGE DRIFT: never change haircut length, fringe/bangs, eyebrow shape, eye colour, nose shape, jawline, signature clothing print, jewelry, or age impression unless the story explicitly states a transformation",
        "IDENTITY ANCHOR: if a character appears again, render them as the exact same person from earlier pages, not a lookalike or a newly interpreted variant",
        "PROP CONTINUITY: recurring objects must keep the same design language, shape, colors, markings, and scale across pages",
        "SCENE ACCURACY: depict the concrete page action, not a generic magical or atmospheric substitute",
      ]
        .filter(Boolean)
        .join(" | ");

    const assembleIllustrationPrompt = (options: {
      purpose: string;
      sceneSpec?: IllustrationSceneSpec;
      featuredCharacterNames?: string[];
      extraLayers?: Array<string | null | undefined>;
    }): string => {
      const featuredNames =
        options.featuredCharacterNames &&
        options.featuredCharacterNames.length > 0
          ? options.featuredCharacterNames
          : options.sceneSpec?.featuredCharacters;
      return [
        buildGlobalStyleLayer(),
        `PURPOSE: ${options.purpose}`,
        buildCanonicalCharacterLayer(featuredNames),
        buildSceneSpecificLayer(options.sceneSpec),
        buildRecurringObjectLayer(options.sceneSpec?.requiredObjects ?? []),
        buildContinuityConstraintLayer(options.sceneSpec),
        NO_TEXT_CONSTRAINT,
        NEGATIVE_PROMPT_GUARDRAILS,
        ...((options.extraLayers ?? []).filter(Boolean) as string[]),
      ]
        .filter(Boolean)
        .join(" | ");
    };

    // Generate cover image  uses STYLE_LOCK + full charAnchorBlock for maximum consistency
    // The cover sets the visual "contract" for the whole book; all page illustrations
    // must match the style established here.
    let coverImageUrl: string | null | undefined = null;
    const descSnippet = description
      ? description.substring(0, 120)
      : "an epic adventure";
    const openingIllustratedPage =
      storyData.pages.find(page =>
        plannedIllustratedPageNumbers.has(page.pageNumber)
      ) || storyData.pages[0];
    const openingSceneSpec = openingIllustratedPage
      ? sceneSpecsByPageNumber.get(openingIllustratedPage.pageNumber)
      : undefined;
    const coverCharacterNames = (
      openingSceneSpec?.characters?.map(character => character.name) ||
      canonicalCharacterProfiles
        .slice(0, Math.max(1, Math.min(2, canonicalCharacterProfiles.length)))
        .map(profile => profile.name)
    )
      .filter(Boolean)
      .slice(0, Math.max(1, Math.min(2, canonicalCharacterProfiles.length)));
    const coverCharacters =
      coverCharacterNames.length > 0
        ? coverCharacterNames
        : canonicalCharacterProfiles
            .slice(
              0,
              Math.max(1, Math.min(2, canonicalCharacterProfiles.length))
            )
            .map(profile => profile.name);
    const openingNarrativeSnippet =
      openingIllustratedPage?.content?.slice(0, 220) || descSnippet;
    const fairyCoverContinuityNote =
      category === "fairy_tale"
        ? "Use the ACTUAL opening story situation and environment as the cover key art. Keep family members together in one coherent scene, with age-accurate height and body scale. Do not invent disconnected collage elements or random fantasy scenery that is not supported by the story opening."
        : null;
    // Cover-specific framing note added on top of the global style lock
    const coverFramingNote =
      {
        fairy_tale:
          "storybook key art of the real opening scene, emotionally warm and coherent, all primary characters grouped in a believable shared environment",
        comic: "iconic hero pose, full-body shot, dramatic background",
        crime_mystery:
          "atmospheric establishing shot, moody cityscape or interior",
        fantasy_scifi:
          "epic wide-angle establishing shot, otherworldly environment",
        romance:
          "intimate two-shot or single-character portrait, emotional expression",
        horror_thriller:
          "ominous establishing shot, dark environment, sense of dread",
      }[category] ||
      "dramatic establishing shot, professional book cover composition";
    const coverScenePrompt = buildScenePrompt({
      blueprint: visualBlueprint,
      sceneSpec: {
        pageNumber: 0,
        sceneSummary: `Cover scene that faithfully establishes the opening story premise. ${openingNarrativeSnippet}`,
        narrativeBeat:
          "Establish the central premise and primary cast with one coherent, story-accurate environment.",
        location: openingSceneSpec?.location || "cover illustration scene",
        environment: openingSceneSpec?.environment || coverFramingNote,
        timeOfDay: openingSceneSpec?.timeOfDay || "match the story premise",
        lighting:
          openingSceneSpec?.lighting ||
          "match the locked global style and remain physically coherent",
        physics:
          openingSceneSpec?.physics ||
          "credible scale, shadows, and environment logic",
        camera: openingSceneSpec?.camera || coverFramingNote,
        composition:
          "cover composition with all primary characters fully visible, readable silhouette, age-accurate scale, and one unified setting",
        continuityFromPrevious:
          "Set the canonical visual contract for the rest of the book.",
        branchDelta:
          "Do not show text; emphasize the core story hook visually and faithfully.",
        mustShow: Array.from(
          new Set(
            [
              descSnippet,
              openingNarrativeSnippet,
              ...(openingSceneSpec?.mustShow || []),
            ].filter(Boolean)
          )
        ),
        explicitExclusions: [
          "text",
          "letters",
          "captions",
          "logos",
          "author names",
          "split-screen collage",
          "disconnected floating props",
        ],
        characters: coverCharacters.map(name => ({
          name,
          action: "hero cover pose",
          pose:
            category === "fairy_tale"
              ? "warm, story-accurate shared moment"
              : "confident, readable pose",
          framing: "fully visible",
          visibility: "fully visible",
        })),
        recurringObjects: (openingSceneSpec?.recurringObjects?.length
          ? openingSceneSpec.recurringObjects
          : recurringObjects.slice(0, 2).map(object => ({
              name: object.name,
              state: "canonical cover appearance",
              visibility: "visible if relevant",
            }))
        ).slice(0, 2),
      },
      pageKind: "cover",
    });
    try {
      const coverResult = await generateImageWithRefCheck(
        "cover",
        [
          buildSceneIdentityPriorityBlock(coverCharacters),
          coverScenePrompt,
          `book cover illustration for a gamebook`,
          "professional publishing quality, full-bleed composition",
          "ABSOLUTE COVER TEXT BAN: do not render the book title, author name, letters, words, logos, captions, faux typography, or decorative text marks anywhere inside the cover illustration. The UI renders all text separately.",
          "COVER RENDERING RULE: every depicted person must be fully illustrated in the locked book style. Never paste, overlay, or partially preserve a real photograph on the cover.",
          `COVER CAST LOCK: show exactly these named character(s) on the cover if they are provided in the scene: ${coverCharacters.join(", ")}. Preserve realistic relative ages, body scale, and heights between adults and children.`,
          fairyCoverContinuityNote,
          charPhotos.length > 0
            ? `CRITICAL FACE IDENTITY: The character(s) depicted on this cover MUST be visually recognisable as the EXACT SAME individuals from their reference photos. Preserve without any modification: exact face shape, skin tone, hair colour, hair style, eye colour, nose shape, jawline, eyebrow thickness. Do NOT genericise, idealise, or redesign any facial feature.`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
        getCharacterReferenceImages(coverCharacters)
      );
      if (coverResult.url) {
        coverImageUrl = coverResult.url;
      }
    } catch (e) {
      console.error("[Books] Cover image generation failed:", e);
    }

    // Parallel image generation with concurrency limit
    // All pages generate their images concurrently (up to CONCURRENCY_LIMIT at a time).
    // DB insertion happens sequentially afterwards to preserve order and get correct IDs.
    const CONCURRENCY_LIMIT = isOtherGenre || isComic ? 1 : 2;
    const totalPages = storyData.pages.length;
    const imageFailures: Array<{ pageNumber: number; error: string }> = [];

    // Semaphore: limits concurrent image generation calls
    let activeCount = 0;
    const waitQueue: Array<() => void> = [];
    const acquireSemaphore = (): Promise<void> => {
      if (activeCount < CONCURRENCY_LIMIT) {
        activeCount++;
        return Promise.resolve();
      }
      return new Promise(resolve => waitQueue.push(resolve));
    };
    const releaseSemaphore = () => {
      const next = waitQueue.shift();
      if (next) {
        next();
      } else {
        activeCount--;
      }
    };

    await db
      .update(books)
      .set({
        generationStep: `Generating ${totalPages} illustrations in parallel…`,
      })
      .where(eq(books.id, bookId));

    // Type for per-page image results
    type PageImageResult = {
      pageNumber: number;
      imageUrl: string | null;
      panels: string[] | null;
    };

    // Launch all image generation tasks concurrently (bounded by semaphore)
    const imageGenTasks = storyData.pages.map(
      page => async (): Promise<PageImageResult> => {
        await acquireSemaphore();
        let imageUrl: string | null = null;
        let panels: string[] | null = null;
        try {
          const pageSceneSpec =
            sceneSpecsByPageNumber.get(page.pageNumber) ||
            sceneSpecFallback({
              pageNumber: page.pageNumber,
              narrative: page.content,
              previousScene: undefined,
              blueprint: visualBlueprint,
            });

          if (isComic) {
            // COMIC: generate THREE independent panel images per page.
            // This replaces the old "single composite + fetch + sharp crop" pipeline,
            // which caused both OOM spikes and inaccurate crop boundaries.

            // Step 1: Extract 3 panel descriptions using LLM for narration + dialogue metadata
            type PanelDialogue = {
              narration: string;
              dialogue: string | null;
              speaker: string | null;
              bubbleType: "speech" | "shout" | null;
            };
            let panelDialogue: PanelDialogue[] = [];
            try {
              const dialogueResp = await invokeLLM({
                messages: [
                  {
                    role: "system" as const,
                    content:
                      "You are a comic book writer. Always respond with valid JSON only. UNICODE RULE: NEVER strip or replace special characters. Preserve all Unicode exactly as written (Turkish, German, French, Spanish, Cyrillic, Chinese, Japanese, Arabic).",
                  },
                  {
                    role: "system" as const,
                    content: `LANGUAGE LOCK (MANDATORY): narration and dialogue for every comic panel must be written entirely in ${language}. Never switch to English unless ${language} is English.`,
                  },
                  {
                    role: "user" as const,
                    content: `Split this comic page content into exactly 3 consecutive panels. Characters: ${charNames || "none"}.\n\nTARGET LANGUAGE: ${language}\n\nPage content: ${page.content}\n\nRespond with JSON:\n{"panels":[{"narration":"1-sentence scene description for the caption/status box","dialogue":"direct spoken words only, no character name prefix, max 10 words, or null","speaker":"character name or null","bubbleType":"speech | shout | null"}]}\n\nCRITICAL RULES:\n- narration and dialogue MUST stay entirely in ${language}; never switch to English unless ${language} is English.\n- the 3 panels must feel like setup -> escalation -> consequence, not three paraphrases of the same moment.\n- dialogue must be raw spoken words only. NEVER prefix with character name (e.g. never write "Alex: Let's go" - write only "Let's go").\n- ONLY use dialogue when a character is audibly speaking to another character, a group, or an enemy. If nobody is being addressed aloud, set dialogue=null, speaker=null, bubbleType=null and put the information into narration instead.\n- internal thoughts, silent reactions, hesitation, self-motivation, and scene-setting belong in narration/status-box text, not in dialogue.\n- use bubbleType="shout" only for clearly yelled or alarmed lines; otherwise use "speech". If dialogue is null, bubbleType must be null.\n- vary the action and staging across panels; do not repeat the same generic line or pose.\n- preserve the same story facts, tone, and continuity from the source page.`,
                  },
                ],
                response_format: { type: "json_object" },
              });
              const rawDlg = dialogueResp.choices[0]?.message?.content || "{}";
              const dlgContent =
                typeof rawDlg === "string" ? rawDlg : JSON.stringify(rawDlg);
              const dlgData = JSON.parse(repairJSON(dlgContent));
              if (
                Array.isArray(dlgData.panels) &&
                dlgData.panels.length === 3
              ) {
                panelDialogue = dlgData.panels.map((panel: any) => {
                  const dialogue =
                    typeof panel?.dialogue === "string" &&
                    panel.dialogue.trim().length > 0
                      ? panel.dialogue.trim()
                      : null;
                  return {
                    narration:
                      typeof panel?.narration === "string"
                        ? panel.narration.trim()
                        : "",
                    dialogue,
                    speaker:
                      dialogue &&
                      typeof panel?.speaker === "string" &&
                      panel.speaker.trim().length > 0
                        ? panel.speaker.trim()
                        : null,
                    bubbleType: dialogue
                      ? panel?.bubbleType === "shout"
                        ? "shout"
                        : "speech"
                      : null,
                  };
                });
              }
            } catch (dlgErr) {
              console.error(
                "[Books] Panel dialogue extraction failed:",
                dlgErr
              );
            }

            // Build narration summaries for panel-specific prompts
            // IMPORTANT: speech bubble text is stored in panelDialogue[] and rendered as React overlay
            // by ComicPageLayout. It must NOT be embedded in the image prompt (NO_TEXT_CONSTRAINT).
            const p1 = panelDialogue[0];
            const p2 = panelDialogue[1];
            const p3 = panelDialogue[2];
            const p1Narr = p1?.narration ?? page.content.substring(0, 80);
            const p2Narr = p2?.narration ?? page.content.substring(80, 160);
            const p3Narr = p3?.narration ?? page.content.substring(160, 240);
            // NOTE: dialogue is intentionally NOT included in the image prompt.
            // Speech bubbles are rendered as React overlays by ComicPageLayout.

            const pageCharacterNames = pageSceneSpec.characters.map(
              character => character.name
            );

            // Extract which characters are mentioned in each panel's narration/dialogue.
            // Fall back to the characters already present in this page's scene spec instead of
            // "all book characters", which makes panel prompts noisy and weakens identity locks.
            const extractMentionedCharacters = (text: string): string[] => {
              const mentioned = new Set<string>();
              for (const char of characterCards) {
                const nameRegex = new RegExp(`\\b${char.name}\\b`, "i");
                if (nameRegex.test(text)) {
                  mentioned.add(char.name);
                }
              }
              return mentioned.size > 0
                ? Array.from(mentioned)
                : pageCharacterNames.length > 0
                  ? pageCharacterNames
                  : canonicalCharacterProfiles
                      .slice(0, 1)
                      .map(profile => profile.name);
            };

            const combineCharacterMentions = (
              narration: string,
              dialogue?: string | null,
              speaker?: string | null
            ) => {
              const names = new Set<string>(
                extractMentionedCharacters(narration)
              );
              if (dialogue) {
                for (const name of extractMentionedCharacters(dialogue)) {
                  names.add(name);
                }
              }
              if (
                speaker &&
                canonicalCharacterProfiles.some(
                  profile => profile.name === speaker
                )
              ) {
                names.add(speaker);
              }
              return Array.from(names);
            };

            const p1Chars = combineCharacterMentions(
              p1Narr,
              p1?.dialogue ?? null,
              p1?.speaker ?? null
            );
            const p2Chars = combineCharacterMentions(
              p2Narr,
              p2?.dialogue ?? null,
              p2?.speaker ?? null
            );
            const p3Chars = combineCharacterMentions(
              p3Narr,
              p3?.dialogue ?? null,
              p3?.speaker ?? null
            );

            // Build filtered character anchor blocks for each panel
            // ENHANCED: Explicit character count enforcement, negative prompts, visual distinctness
            const buildFilteredCharAnchor = (charNames: string[]): string => {
              const relevantChars = canonicalCharacterProfiles.filter(c =>
                charNames.includes(c.name)
              );
              if (relevantChars.length === 0) return charAnchorBlock;

              const charDescriptions = relevantChars
                .map((c, idx) => {
                  const distinctMarker =
                    relevantChars.length > 1
                      ? ` [CHARACTER ${idx + 1}/${relevantChars.length} - MUST BE VISUALLY COMPLETELY DIFFERENT]`
                      : "";
                  return formatCompactCanonicalProfile(c, distinctMarker);
                })
                .join(" || ");
              const charList = relevantChars.map(c => c.name).join(", ");
              return [
                `PANEL CHARACTERS: ${charDescriptions}`,
                relevantChars.some(c => photoRefByName.has(c.name))
                  ? `PHOTO REFERENCES (EXACT FACIAL MATCH): ${relevantChars
                      .filter(c => photoRefByName.has(c.name))
                      .map(c => c.name)
                      .join(", ")}. Render EXACTLY as photographed.`
                  : "",
                `CHARACTER COUNT: Render EXACTLY ${relevantChars.length} distinct character(s). EXACTLY ${relevantChars.length}.`,
                relevantChars.length > 1
                  ? `MANDATORY VISUAL CONTRAST: Each of these ${relevantChars.length} characters (${charList}) MUST look COMPLETELY DIFFERENT. Different hair, body shape, face, clothing, skin tone. ZERO similarity.`
                  : "",
                `CRITICAL RULES: NEVER duplicate. NEVER show same person twice. NEVER blend. NEVER lookalikes. Each character is unique.`,
              ]
                .filter(Boolean)
                .join(" | ");
            };

            const p1CharAnchor = buildFilteredCharAnchor(p1Chars);
            const p2CharAnchor = buildFilteredCharAnchor(p2Chars);
            const p3CharAnchor = buildFilteredCharAnchor(p3Chars);
            type PanelLayout = "hero-top" | "support-left" | "support-right";
            type ComicPanelData = {
              imageUrl: string;
              narration: string;
              dialogue: string | null;
              speaker: string | null;
              bubbleType: string | null;
              position: string | null;
            };
            const panelData: ComicPanelData[] = [];
            const buildComicPanelSceneSpec = (
              panelCharacters: string[],
              narration: string,
              layout: PanelLayout
            ): SceneSpec => {
              const existingCharacters = pageSceneSpec.characters.filter(
                character => panelCharacters.includes(character.name)
              );
              const panelSpecificCharacters =
                existingCharacters.length > 0
                  ? existingCharacters
                  : panelCharacters.map(name => ({
                      name,
                      action: "active in the scene",
                      pose:
                        layout === "hero-top"
                          ? "dynamic establishing pose"
                          : "focused comic panel pose",
                      framing:
                        layout === "hero-top"
                          ? "clearly readable within a wide hero panel"
                          : "fully visible inside a supporting panel",
                      visibility: "fully visible and unobstructed",
                    }));

              return {
                ...pageSceneSpec,
                sceneSummary: narration,
                narrativeBeat: narration,
                lighting:
                  layout === "hero-top"
                    ? pageSceneSpec.lighting ||
                      "dramatic comic-book establishing lighting"
                    : pageSceneSpec.lighting ||
                      "focused comic-book panel lighting",
                composition:
                  layout === "hero-top"
                    ? "single wide comic hero panel; complete action readable within panel bounds"
                    : "single comic supporting panel; keep the full action readable inside the frame",
                camera:
                  layout === "hero-top"
                    ? "wide cinematic establishing view"
                    : layout === "support-left"
                      ? "medium close-up comic panel"
                      : "medium action comic panel",
                characters: panelSpecificCharacters,
              };
            };

            const buildPanelPrompt = (
              panelCharacters: string[],
              narration: string,
              filteredAnchor: string,
              layout: PanelLayout
            ) => {
              const panelSceneSpec = buildComicPanelSceneSpec(
                panelCharacters,
                narration,
                layout
              );
              const panelRefs = selectReferenceImages({
                sceneSpec: panelSceneSpec,
                blueprint: visualBlueprint,
                portraitRefs: portraitReferenceMap,
                photoRefs: photoRefByName,
              }).filter(
                (
                  img
                ): img is {
                  url?: string;
                  mimeType?: string;
                  b64Json?: string;
                } => !!img?.url || !!img?.b64Json
              );

              const layoutInstruction =
                layout === "hero-top"
                  ? "Render ONE standalone comic hero panel image only. Compose it as a wide establishing panel with the full action entirely inside frame. Do NOT include gutters, neighboring panels, captions, speech bubbles, or any text baked into the art."
                  : layout === "support-left"
                    ? "Render ONE standalone comic support panel image only. Compose it as the LEFT supporting panel of a page, keeping the full subject entirely inside frame. Do NOT include gutters, neighboring panels, captions, speech bubbles, or any text baked into the art."
                    : "Render ONE standalone comic support panel image only. Compose it as the RIGHT supporting panel of a page, keeping the full subject entirely inside frame. Do NOT include gutters, neighboring panels, captions, speech bubbles, or any text baked into the art.";

              const prompt = [
                buildSceneIdentityPriorityBlock(panelCharacters),
                buildScenePrompt({
                  blueprint: visualBlueprint,
                  sceneSpec: panelSceneSpec,
                  pageKind: "comic",
                }),
                layoutInstruction,
                `PANEL STORY BEAT: ${narration}`,
                filteredAnchor,
                "IDENTITY CONTINUITY (MANDATORY): The same named character must keep the exact same face identity across ALL comic panels and ALL pages (same facial geometry, eye shape, nose, jawline, hairline, eyebrow shape, skin tone).",
                "NO SPONTANEOUS WARDROBE CHANGES: keep each named character in the exact same canonical outfit, accessories, tie, watch, hairstyle, and silhouette unless the narrative explicitly states a transformation.",
                CHARACTER_COLOUR_LOCK,
                STRUCTURED_IDENTITY_BLOCK || undefined,
                CHARACTER_LOCK_INSTRUCTION,
                "STYLE CONTINUITY: Match the exact art style, colour palette, lighting, and illustration technique of the book cover image. Every interior comic panel must look like it belongs to the same book as the cover.",
              ]
                .filter(Boolean)
                .join(" | ");

              return { panelRefs, prompt };
            };

            const comicPanels = [
              {
                stage: `page-${page.pageNumber}-panel-top`,
                narration: p1Narr,
                dialogue: p1?.dialogue ?? null,
                speaker: p1?.speaker ?? null,
                bubbleType: p1?.bubbleType ?? null,
                characters: p1Chars,
                anchor: p1CharAnchor,
                layout: "hero-top" as const,
                position: "top-right",
              },
              {
                stage: `page-${page.pageNumber}-panel-left`,
                narration: p2Narr,
                dialogue: p2?.dialogue ?? null,
                speaker: p2?.speaker ?? null,
                bubbleType: p2?.bubbleType ?? null,
                characters: p2Chars,
                anchor: p2CharAnchor,
                layout: "support-left" as const,
                position: "top-left",
              },
              {
                stage: `page-${page.pageNumber}-panel-right`,
                narration: p3Narr,
                dialogue: p3?.dialogue ?? null,
                speaker: p3?.speaker ?? null,
                bubbleType: p3?.bubbleType ?? null,
                characters: p3Chars,
                anchor: p3CharAnchor,
                layout: "support-right" as const,
                position: "top-right",
              },
            ];

            for (const panel of comicPanels) {
              const { panelRefs, prompt } = buildPanelPrompt(
                panel.characters,
                panel.narration,
                panel.anchor,
                panel.layout
              );
              const fallbackPanelUrl =
                panelRefs[0]?.url ||
                getCharacterReferenceImages(panel.characters)[0]?.url ||
                coverImageUrl ||
                Array.from(illustratedPortraitsMap.values())[0]?.url ||
                null;

              try {
                const panelResult = await generateImageWithRefCheck(
                  panel.stage,
                  prompt,
                  panelRefs.length > 0
                    ? panelRefs
                    : getCharacterReferenceImages(panel.characters)
                );
                if (panelResult.url) {
                  panelData.push({
                    imageUrl: panelResult.url,
                    narration: panel.narration,
                    dialogue: panel.dialogue,
                    speaker: panel.speaker,
                    bubbleType: panel.bubbleType,
                    position: panel.position,
                  });
                  continue;
                }
              } catch (panelErr) {
                console.error(
                  `[Books] Comic panel generation failed for page ${page.pageNumber} (${panel.stage}):`,
                  panelErr
                );
              }

              if (fallbackPanelUrl) {
                panelData.push({
                  imageUrl: fallbackPanelUrl,
                  narration: panel.narration,
                  dialogue: panel.dialogue,
                  speaker: panel.speaker,
                  bubbleType: panel.bubbleType,
                  position: panel.position,
                });
                console.warn(
                  `[Books] Page ${page.pageNumber}: used fallback panel placeholder for ${panel.stage}`
                );
              }
            }

            // Store full ComicPanel objects (not plain string URLs) so React overlay can render speech bubbles
            panels =
              panelData.length > 0 ? (panelData as unknown as string[]) : null;
            imageUrl = null; // panels stored separately
          } else if (category === "fairy_tale") {
            // FAIRY TALE: one illustration per page (10 pages = 10 illustrations)
            const fairyRefs = selectReferenceImages({
              sceneSpec: pageSceneSpec,
              blueprint: visualBlueprint,
              portraitRefs: portraitReferenceMap,
              photoRefs: photoRefByName,
            }).filter(
              (
                img
              ): img is { url?: string; mimeType?: string; b64Json?: string } =>
                !!img?.url || !!img?.b64Json
            );
            const imgResult = await generateImageWithRefCheck(
              `page-${page.pageNumber}`,
              [
                buildSceneIdentityPriorityBlock(
                  pageSceneSpec.characters.map(character => character.name)
                ),
                buildScenePrompt({
                  blueprint: visualBlueprint,
                  sceneSpec: pageSceneSpec,
                  pageKind: "page",
                }),
                "PAGE STORY FIDELITY: depict this page's actual story beat while preserving the same character design, environment logic, and emotional continuity used across the rest of the book.",
                "AGE AND SCALE LOCK: adults and children must keep realistic relative ages, heights, and body proportions across all illustrations. Never render an older child as a toddler or baby-faced infant unless the story explicitly says so.",
                CHARACTER_COLOUR_LOCK,
                STRUCTURED_IDENTITY_BLOCK || undefined,
                CHARACTER_LOCK_INSTRUCTION,
                "STYLE CONTINUITY: Match the exact art style, colour palette, lighting, and illustration technique of the book cover image  every interior page must look like it belongs to the same book as the cover",
                "same character appearance as all other illustrations in this book. CRITICAL: characters' faces, hair colour, hair style, eyebrow colour, skin tone, and clothing MUST match their reference photos and character cards EXACTLY  do NOT alter any facial features or clothing between pages",
              ]
                .filter(Boolean)
                .join(" | "),
              fairyRefs.length > 0 ? fairyRefs : undefined
            );
            imageUrl = imgResult.url ?? null;
          } else if (isOtherGenre) {
            // OTHER GENRES: images only at branch pages, up to branchImageCount
            // Spec: normal = 8 branch images, thick = 12 branch images
            // Only isBranchPage pages get illustrations; all other pages are text-only.
            if (branchPageNumbers.has(page.pageNumber)) {
              const branchRefs = selectReferenceImages({
                sceneSpec: pageSceneSpec,
                blueprint: visualBlueprint,
                portraitRefs: portraitReferenceMap,
                photoRefs: photoRefByName,
              }).filter(
                (
                  img
                ): img is {
                  url?: string;
                  mimeType?: string;
                  b64Json?: string;
                } => !!img?.url || !!img?.b64Json
              );
              const imgResult = await generateImageWithRefCheck(
                `page-${page.pageNumber}-branch`,
                [
                  buildSceneIdentityPriorityBlock(
                    pageSceneSpec.characters.map(character => character.name)
                  ),
                  buildScenePrompt({
                    blueprint: visualBlueprint,
                    sceneSpec: pageSceneSpec,
                    pageKind: "page",
                  }),
                  CHARACTER_COLOUR_LOCK,
                  STRUCTURED_IDENTITY_BLOCK || undefined,
                  CHARACTER_LOCK_INSTRUCTION,
                  "STYLE CONTINUITY: Match the exact art style, colour palette, lighting, and illustration technique of the book cover image  every interior page must look like it belongs to the same book as the cover.",
                  "same character appearance as all other illustrations in this book. CRITICAL: characters' faces, hair colour, hair style, eyebrow colour, skin tone, and clothing MUST match their reference photos and character cards EXACTLY  do NOT alter any facial features or clothing between pages",
                ]
                  .filter(Boolean)
                  .join(" | "),
                branchRefs.length > 0 ? branchRefs : undefined
              );
              imageUrl = imgResult.url ?? null;
              console.log(
                `[Books] Branch image generated for page ${page.pageNumber}`
              );
            }
            // Non-branch pages: imageUrl stays null (text-only)
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          imageFailures.push({ pageNumber: page.pageNumber, error: errMsg });
          console.error(
            `[Books] Image generation failed for page ${page.pageNumber}:`,
            e
          );
        } finally {
          releaseSemaphore();
        }
        return { pageNumber: page.pageNumber, imageUrl, panels };
      }
    );

    // Run all image generation tasks concurrently (bounded by semaphore)
    const pageImageResults: PageImageResult[] = await Promise.all(
      imageGenTasks.map(task => task())
    );

    // Build a lookup from pageNumber image result
    const imageResultByPage = new Map<number, PageImageResult>();
    for (const r of pageImageResults) {
      imageResultByPage.set(r.pageNumber, r);
    }

    // Enforce required illustration counts to avoid shipping "ready" books without images.
    if (category === "fairy_tale") {
      const generatedFairy = illustratedStoryPages.filter(
        p => !!imageResultByPage.get(p.pageNumber)?.imageUrl
      ).length;
      const expectedIllustratedPages = illustratedStoryPages.length;
      const minRequired = Math.floor(expectedIllustratedPages * 0.75); // allow up to 25% image failures
      if (generatedFairy < minRequired) {
        const failureInfo = imageFailures
          .slice(0, 3)
          .map(f => `p${f.pageNumber}: ${f.error}`)
          .join(" | ");
        throw new Error(
          `Fairy tale illustration shortfall: expected ${expectedIllustratedPages}, got ${generatedFairy} (min ${minRequired})${failureInfo ? `; sample failures: ${failureInfo}` : ""}`
        );
      }
    }

    if (category === "comic") {
      const generatedComic = illustratedStoryPages.filter(p => {
        const panels = imageResultByPage.get(p.pageNumber)?.panels;
        return Array.isArray(panels) && panels.length >= 3;
      }).length;
      const expectedIllustratedPages = illustratedStoryPages.length;
      if (generatedComic < expectedIllustratedPages) {
        const failureInfo = imageFailures
          .slice(0, 3)
          .map(f => `p${f.pageNumber}: ${f.error}`)
          .join(" | ");
        throw new Error(
          `Comic panel shortfall: expected ${expectedIllustratedPages} pages with panels, got ${generatedComic}${failureInfo ? `; sample failures: ${failureInfo}` : ""}`
        );
      }
    }

    if (isOtherGenre && branchImageCount > 0) {
      const generatedBranch = Array.from(branchPageNumbers).filter(
        n => !!imageResultByPage.get(n)?.imageUrl
      ).length;
      const minBranch = Math.floor(branchImageCount * 0.75); // allow up to 25% image failures
      if (generatedBranch < minBranch) {
        const failureInfo = imageFailures
          .slice(0, 3)
          .map(f => `p${f.pageNumber}: ${f.error}`)
          .join(" | ");
        throw new Error(
          `Branch illustration shortfall: expected ${branchImageCount}, got ${generatedBranch} (min ${minBranch})${failureInfo ? `; sample failures: ${failureInfo}` : ""}`
        );
      }
    }

    // Sequential DB insertion (preserves order, gets correct IDs)
    const insertedPageIds: Record<number, number> = {};
    await db
      .update(books)
      .set({ generationStep: "Saving pages to library…" })
      .where(eq(books.id, bookId));
    for (const page of storyData.pages) {
      const result = imageResultByPage.get(page.pageNumber);
      const imageUrl = result?.imageUrl ?? null;
      const panels = result?.panels ?? null;

      await db.insert(bookPages).values({
        bookId,
        pageNumber: page.pageNumber,
        branchPath: page.branchPath || "root",
        isBranchPage: page.isBranchPage,
        content: page.content,
        imageUrl,
        panels,
        choiceA: page.choiceA,
        choiceB: page.choiceB,
        sfxTags: page.sfxTags || [],
        sceneSpec: sceneSpecsByPageNumber.get(page.pageNumber) ?? null,
        format: isLandscape ? "landscape" : "portrait",
      });

      const insertedPage = await db
        .select()
        .from(bookPages)
        .where(
          and(
            eq(bookPages.bookId, bookId),
            eq(bookPages.pageNumber, page.pageNumber)
          )
        )
        .limit(1);

      if (insertedPage[0]) {
        insertedPageIds[page.pageNumber] = insertedPage[0].id;
      }
    }

    // Update nextPageIdA and nextPageIdB references
    for (const page of storyData.pages) {
      const pageId = insertedPageIds[page.pageNumber];
      if (!pageId) continue;

      if (page.nextPageA || page.nextPageB) {
        await db
          .update(bookPages)
          .set({
            nextPageIdA: page.nextPageA
              ? insertedPageIds[page.nextPageA]
              : null,
            nextPageIdB: page.nextPageB
              ? insertedPageIds[page.nextPageB]
              : null,
          })
          .where(eq(bookPages.id, pageId));
      }
    }

    // Update book status to ready  persist character cards + illustration style lock + portrait URLs
    // Build portraitUrls mapping from illustratedPortraits array
    const portraitUrlsMap = characterCards
      .map((char, idx) => ({
        characterName: char.name,
        url: illustratedPortraitsMap.get(char.name)?.url || null,
      }))
      .filter(p => p.url);

    await db
      .update(books)
      .set({
        status: "ready",
        generationStep: null, // clear step when done
        coverImageUrl,
        totalPages: pageCount,
        totalBranches: storyData.pages.filter(p => p.isBranchPage).length,
        characterCards: characterCards.length > 0 ? characterCards : null,
        portraitUrls: portraitUrlsMap.length > 0 ? portraitUrlsMap : null,
        illustrationStyleLock: STYLE_LOCK, // stored for admin/debug inspection
        visualBlueprint,
      })
      .where(eq(books.id, bookId));

    console.log(
      `[Books] Book ${bookId} generation complete. Character cards saved: ${characterCards.length}. Portraits generated: ${portraitUrlsMap.length}. Readable path length: ${pageCount}. Graph pages: ${storyData.pages.length}.`
    );
  } catch (error) {
    console.error("[Books] Generation failed:", error);
    await db
      .update(books)
      .set({
        status: "failed",
        generationStep:
          error instanceof Error
            ? error.message.slice(0, 240)
            : "Generation failed",
      })
      .where(eq(books.id, bookId));
    // Clean up any uploaded character photos on failure
    if (bookData.uploadedKeys?.length) {
      for (const key of bookData.uploadedKeys) {
        await storageDelete(key);
      }
    }
  }
}

export const booksRouter = router({
  // Get credit cost for a book configuration
  getCreditCost: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        length: z.string(),
        characterPhotoCount: z.number().default(0),
      })
    )
    .query(({ input }) => {
      if (!isLengthAllowedForCategory(input.category, input.length)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid length "${input.length}" for category "${input.category}".`,
        });
      }
      return computeTotalCost(
        input.category,
        input.length,
        input.characterPhotoCount
      );
    }),

  // Create and generate a book
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(120).trim(),
        category: z.enum([
          "fairy_tale",
          "comic",
          "crime_mystery",
          "fantasy_scifi",
          "romance",
          "horror_thriller",
        ]),
        length: z.enum(["thin", "normal", "thick"]),
        bookLanguage: z.string().max(10).default("en"),
        description: z.string().max(5000).default(""),
        characters: z
          .array(
            z.object({
              name: z.string().min(1).max(60).trim(),
              photoBase64: z.string().optional(),
              photoMimeType: z.string().optional(),
              photoUrl: z.string().url().max(2000).optional(),
            })
          )
          .max(10)
          .default([]),
        safetyChecked: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check user status before any DB call
      if (ctx.user.status === "suspended" || ctx.user.accountLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.accountLocked
            ? "Account locked due to payment issue. Please contact support."
            : "Account suspended",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      // Content moderation check
      const blockedTerms = [
        "hate speech",
        "explicit sexual",
        "extreme violence",
        "self-harm",
        "propaganda",
        "racism",
      ];
      const descLower = input.description.toLowerCase();
      if (blockedTerms.some(term => descLower.includes(term))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Content violates safety guidelines",
        });
      }

      if (!isLengthAllowedForCategory(input.category, input.length)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid length "${input.length}" for category "${input.category}".`,
        });
      }

      // Calculate cost always read from shared/pricing.ts (source of truth: shared/pricing.csv)
      const charPhotos = input.characters.filter(
        c => c.photoBase64 || c.photoUrl
      ).length;
      const { total } = computeTotalCost(
        input.category,
        input.length,
        charPhotos
      );

      // Check balance
      const walletRows = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id))
        .limit(1);
      const balance = walletRows[0]?.balance ?? 0;
      if (balance < total) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: "Insufficient credits",
        });
      }

      // Deduct credits
      await adjustCredits(
        ctx.user.id,
        -total,
        "spend_generate",
        `Generated book: ${input.title}`
      );

      // Upload character photos
      // Validate all character photo uploads before touching S3
      for (const char of input.characters) {
        if (char.photoBase64 && char.photoMimeType) {
          const err = validateUpload(
            char.photoBase64,
            char.photoMimeType,
            "characterPhoto"
          );
          if (err) {
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        } else if (char.photoUrl) {
          // Validate URL shape early and fail-fast for malformed Google Drive links.
          normaliseCharacterPhotoUrl(char.photoUrl);
        }
      }

      // Upload character photos, tracking keys for cleanup on failure
      const uploadedKeys: string[] = [];
      const characterData: Array<{ name: string; photoUrl?: string }> = [];
      for (const char of input.characters) {
        let photoUrl: string | undefined;
        let base64Data = char.photoBase64;
        let mimeType = char.photoMimeType;

        if (!base64Data && char.photoUrl) {
          const downloaded = await fetchCharacterPhotoFromUrl(char.photoUrl);
          base64Data = downloaded.base64Data;
          mimeType = downloaded.mimeType;
        }

        if (base64Data && mimeType) {
          const buffer = Buffer.from(base64Data, "base64");
          const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
          const key = `characters/${ctx.user.id}-${nanoid(8)}.${ext}`;
          const result = await storagePut(key, buffer, mimeType);
          uploadedKeys.push(key);
          photoUrl = result.url;
        }
        characterData.push({ name: sanitizeText(char.name), photoUrl });
      }

      // Sanitize user-generated text at write-time
      const cleanTitle = sanitizeText(input.title);
      const cleanDescription = sanitizeRichText(input.description);

      // Create book record
      const [bookInsertResult] = await db.insert(books).values({
        authorId: ctx.user.id,
        title: cleanTitle,
        category: input.category,
        length: input.length,
        bookLanguage: input.bookLanguage,
        description: cleanDescription,
        status: "generating",
      });

      // Get the book id from MySQL insertId
      const bookId = (bookInsertResult as any).insertId as number;
      if (!bookId)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create book record",
        });

      // Insert characters
      for (let i = 0; i < characterData.length; i++) {
        await db.insert(bookCharacters).values({
          bookId,
          name: characterData[i].name,
          photoUrl: characterData[i].photoUrl,
          orderIndex: i,
        });
      }

      // Add to user's library
      await db.insert(userBooks).values({
        userId: ctx.user.id,
        bookId,
        acquiredVia: "generated",
        pricePaid: 0,
      });

      // Create a generation job record for tracking / retry UI
      const [jobInsertResult] = await db
        .insert(generationJobs)
        .values({ bookId });
      const jobId = (jobInsertResult as any)?.insertId as number | undefined;

      // Mark job as generating and start background work
      if (jobId) {
        await db
          .update(generationJobs)
          .set({ status: "generating", startedAt: new Date() })
          .where(eq(generationJobs.id, jobId));
      }

      // Start generation via lease-based worker (fire-and-forget, double-processing safe)
      if (jobId) {
        const userId = ctx.user.id;
        const bookTitle = input.title;
        claimAndRunJob(
          jobId,
          bookId,
          {
            title: input.title,
            category: input.category,
            length: input.length,
            description: input.description,
            language: input.bookLanguage,
            characters: characterData,
            uploadedKeys,
          },
          db,
          async (bid, data) => {
            await generateBookContent(bid, data);
            // Notify user when done
            const updatedBook = await db
              .select()
              .from(books)
              .where(eq(books.id, bid))
              .limit(1);
            if (updatedBook[0]?.status === "ready") {
              await createNotification(
                userId,
                "book_ready",
                "Book Generation Complete!",
                `Your book "${bookTitle}" is ready to read.`,
                `/reader/${bid}`
              );
            }
          }
        ).catch(console.error);
      }

      return { bookId, status: "generating", jobId: jobId ?? null };
    }),

  // Get user's library
  myLibrary: protectedProcedure
    .input(
      z.object({
        search: z.string().max(120).optional(),
        category: z.string().max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const owned = await db
        .select({ bookId: userBooks.bookId })
        .from(userBooks)
        .where(eq(userBooks.userId, ctx.user.id));

      if (owned.length === 0) return [];

      const bookIds = owned.map(o => o.bookId);

      const { readingProgress } = await import("../../drizzle/schema");

      const query = await db
        .select({
          book: {
            id: books.id,
            authorId: books.authorId,
            title: books.title,
            category: books.category,
            bookLanguage: books.bookLanguage,
            length: books.length,
            coverImageUrl: books.coverImageUrl,
            status: books.status,
            totalPages: books.totalPages,
            isPublished: books.isPublished,
            storePrice: books.storePrice,
            reviewCount: books.reviewCount,
            averageRating: books.averageRating,
            generationStep: books.generationStep,
            createdAt: books.createdAt,
            updatedAt: books.updatedAt,
          },
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
          completedAt: readingProgress.completedAt,
        })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .leftJoin(
          readingProgress,
          and(
            eq(readingProgress.bookId, books.id),
            eq(readingProgress.userId, ctx.user.id)
          )
        )
        .where(
          and(
            inArray(books.id, bookIds),
            // Deleted books are hidden from the author's own Library.
            // Purchasers who already own the book still see it (userBooks row intact).
            // We exclude books where status=deleted AND the viewer is the author.
            sql`NOT (${books.status} = 'deleted' AND ${books.authorId} = ${ctx.user.id})`,
            input.category
              ? eq(books.category, input.category as any)
              : undefined,
            input.search ? like(books.title, `%${input.search}%`) : undefined
          )
        )
        .orderBy(desc(books.createdAt));

      // For failed books, fetch the latest job's errorMessage and attempts
      const failedBookIds = query
        .filter(r => r.book.status === "failed")
        .map(r => r.book.id);

      const jobErrors: Record<
        number,
        { errorMessage: string | null; attempts: number }
      > = {};
      if (failedBookIds.length > 0) {
        const jobs = await db
          .select({
            bookId: generationJobs.bookId,
            errorMessage: generationJobs.errorMessage,
            attempts: generationJobs.attempts,
          })
          .from(generationJobs)
          .where(inArray(generationJobs.bookId, failedBookIds))
          .orderBy(desc(generationJobs.createdAt));
        // Keep only the latest job per book
        for (const j of jobs) {
          if (!jobErrors[j.bookId])
            jobErrors[j.bookId] = {
              errorMessage: j.errorMessage,
              attempts: j.attempts,
            };
        }
      }

      return query.map(row => ({
        ...row,
        isCompleted: !!row.completedAt,
        jobError:
          row.book.status === "failed"
            ? (jobErrors[row.book.id]?.errorMessage ?? null)
            : null,
        jobAttempts:
          row.book.status === "failed"
            ? (jobErrors[row.book.id]?.attempts ?? 0)
            : 0,
      }));
    }),

  // Get book details
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select({
          book: books,
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
          authorId: users.id,
        })
        .from(books)
        .leftJoin(users, eq(books.authorId, users.id))
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .where(eq(books.id, input.id))
        .limit(1);

      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const chars = await db
        .select()
        .from(bookCharacters)
        .where(eq(bookCharacters.bookId, input.id));

      return { ...result[0], characters: chars };
    }),

  // Get book pages for reader
  getPages: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check ownership
      const owned = await db
        .select()
        .from(userBooks)
        .where(
          and(
            eq(userBooks.userId, ctx.user.id),
            eq(userBooks.bookId, input.bookId)
          )
        )
        .limit(1);

      if (!owned[0]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't own this book",
        });
      }

      const pages = await db
        .select()
        .from(bookPages)
        .where(eq(bookPages.bookId, input.bookId))
        .orderBy(bookPages.pageNumber);

      const pageById = new Map(pages.map(page => [page.id, page]));
      const incomingPageIds = new Set<number>();
      for (const page of pages) {
        if (page.nextPageIdA) incomingPageIds.add(page.nextPageIdA);
        if (page.nextPageIdB) incomingPageIds.add(page.nextPageIdB);
      }
      const routePageNumberById = new Map<number, number>();
      const visitPage = (
        pageId: number,
        depth: number,
        active: Set<number>
      ) => {
        if (active.has(pageId)) return;
        const existingDepth = routePageNumberById.get(pageId);
        if (existingDepth && existingDepth >= depth) return;
        const page = pageById.get(pageId);
        if (!page) return;
        routePageNumberById.set(pageId, depth);
        active.add(pageId);
        if (page.nextPageIdA) visitPage(page.nextPageIdA, depth + 1, active);
        if (page.nextPageIdB) visitPage(page.nextPageIdB, depth + 1, active);
        active.delete(pageId);
      };
      const rootPages = pages.filter(page => !incomingPageIds.has(page.id));
      for (const rootPage of rootPages) {
        visitPage(rootPage.id, 1, new Set<number>());
      }
      const pagesWithRouteNumber = pages.map(page => ({
        ...page,
        routePageNumber: routePageNumberById.get(page.id) ?? page.pageNumber,
      }));

      // Fetch character cards and portrait URLs for the Characters panel in Reader
      const bookRow = await db
        .select({
          characterCards: books.characterCards,
          portraitUrls: books.portraitUrls,
        })
        .from(books)
        .where(eq(books.id, input.bookId))
        .limit(1);

      type CharacterCard = {
        name: string;
        appearance: string;
        voice: string;
        role: string;
        photoUrl?: string;
        portraitUrl?: string;
      };
      type PortraitUrl = { characterName: string; url: string };
      const characterCards =
        (bookRow[0]?.characterCards as CharacterCard[] | null) ?? [];
      const portraitUrls =
        (bookRow[0]?.portraitUrls as PortraitUrl[] | null) ?? [];

      // Build a map of character name , portrait URL for easy lookup
      const portraitMap = new Map(
        portraitUrls.map(p => [p.characterName, p.url])
      );

      // Inject portrait URLs into character cards
      const enrichedCards = characterCards.map(card => ({
        ...card,
        portraitUrl: portraitMap.get(card.name) || undefined,
      }));

      return { pages: pagesWithRouteNumber, characterCards: enrichedCards };
    }),

  // Check generation status
  getStatus: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const book = await db
        .select({
          status: books.status,
          totalPages: books.totalPages,
          generationStep: books.generationStep,
        })
        .from(books)
        .where(and(eq(books.id, input.bookId), eq(books.authorId, ctx.user.id)))
        .limit(1);

      if (!book[0]) {
        // Avoid noisy NOT_FOUND polling errors on stale cards, treat as pending unknown.
        return {
          status: "pending" as const,
          totalPages: 0,
          generationStep: null,
        };
      }

      return {
        status: book[0].status,
        totalPages: book[0].totalPages,
        generationStep: book[0].generationStep ?? null,
      };
    }),

  // Store listing
  storeListing: publicProcedure
    .input(
      z.object({
        search: z.string().max(120).optional(),
        category: z.string().max(50).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return [];
      }

      const conditions = [
        eq(books.isPublished, true),
        eq(books.isDelisted, false),
        eq(books.status, "ready"),
      ];

      if (input.category)
        conditions.push(eq(books.category, input.category as any));
      if (input.search) {
        const searchPattern = `%${input.search}%`;
        const searchCondition = or(
          like(books.title, searchPattern),
          like(profiles.authorName, searchPattern)
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      // Get active campaigns
      const activeCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.isActive, true));

      const result = await db
        .select({
          book: books,
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
          authorDeleted: users.status,
        })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .leftJoin(users, eq(books.authorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(books.purchaseCount))
        .limit(input.limit)
        .offset(input.offset);

      // Apply campaign discounts
      return result.map(row => {
        const campaign = activeCampaigns.find(c => {
          const cats = c.targetCategories as string[];
          return cats.includes(row.book.category);
        });

        let discountedPrice = row.book.storePrice;
        if (campaign && discountedPrice) {
          if (campaign.discountType === "percent") {
            discountedPrice = Math.ceil(
              discountedPrice * (1 - campaign.discountValue / 100)
            );
          } else {
            discountedPrice = Math.max(
              1,
              discountedPrice - campaign.discountValue
            );
          }
        }

        return {
          ...row,
          authorName:
            row.authorDeleted === "deleted"
              ? "[Deleted Author]"
              : row.authorName,
          discountedPrice,
          hasCampaign: !!campaign,
        };
      });
    }),

  // Publish book to store
  publish: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        price: z.number().int().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (ctx.user.status === "suspended" || ctx.user.accountLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.accountLocked
            ? "Account locked due to payment issue. Please contact support."
            : "Account suspended.",
        });
      }

      const book = await db
        .select()
        .from(books)
        .where(and(eq(books.id, input.bookId), eq(books.authorId, ctx.user.id)))
        .limit(1);

      if (!book[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (book[0].status !== "ready") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Book not ready" });
      }

      await db
        .update(books)
        .set({ isPublished: true, storePrice: input.price })
        .where(eq(books.id, input.bookId));

      // Refresh author stats cache (fire-and-forget)
      refreshAuthorStats(ctx.user.id, db).catch(console.error);

      return { success: true };
    }),

  // Buy a book
  buy: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.status === "suspended" || ctx.user.accountLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.accountLocked
            ? "Account locked due to payment issue. Please contact support."
            : "Account suspended",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Validate book ownership
      const existing = await db
        .select()
        .from(userBooks)
        .where(
          and(
            eq(userBooks.userId, ctx.user.id),
            eq(userBooks.bookId, input.bookId)
          )
        )
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({ code: "CONFLICT", message: "Already owned" });
      }

      const bookData = await db
        .select()
        .from(books)
        .where(
          and(
            eq(books.id, input.bookId),
            eq(books.isPublished, true),
            eq(books.isDelisted, false)
          )
        )
        .limit(1);

      if (!bookData[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (!bookData[0].storePrice) throw new TRPCError({ code: "BAD_REQUEST" });

      const listPrice = bookData[0].storePrice;

      // Get campaign discount
      const activeCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.isActive, true));
      const campaign = activeCampaigns.find(c => {
        const cats = c.targetCategories as string[];
        return cats.includes(bookData[0].category);
      });

      let buyerPrice = listPrice;
      if (campaign) {
        if (campaign.discountType === "percent") {
          buyerPrice = Math.ceil(
            listPrice * (1 - campaign.discountValue / 100)
          );
        } else {
          buyerPrice = Math.max(1, listPrice - campaign.discountValue);
        }
      }

      // Author always gets 30% of LIST price
      const authorEarning = Math.floor(listPrice * 0.3);

      // Check buyer balance
      const buyerWallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id))
        .limit(1);
      if ((buyerWallet[0]?.balance ?? 0) < buyerPrice) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: "Insufficient credits",
        });
      }

      // Deduct from buyer
      await adjustCredits(
        ctx.user.id,
        -buyerPrice,
        "spend_buy",
        `Purchased: ${bookData[0].title}`,
        String(input.bookId)
      );

      // Credit author
      await adjustCredits(
        bookData[0].authorId,
        authorEarning,
        "earn_sale",
        `Sale of: ${bookData[0].title}`,
        String(input.bookId)
      );

      // Add to buyer's library
      await db.insert(userBooks).values({
        userId: ctx.user.id,
        bookId: input.bookId,
        acquiredVia: "purchased",
        pricePaid: buyerPrice,
      });

      // Update purchase count
      await db
        .update(books)
        .set({ purchaseCount: (bookData[0].purchaseCount || 0) + 1 })
        .where(eq(books.id, input.bookId));

      // Notify author
      const authorProfile = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, bookData[0].authorId))
        .limit(1);
      await createNotification(
        bookData[0].authorId,
        "book_sold",
        "Your book was purchased!",
        `Someone purchased "${bookData[0].title}". You earned ${authorEarning} credits.`,
        `/library`
      );

      // Notify buyer
      await createNotification(
        ctx.user.id,
        "book_purchased",
        "Purchase Successful!",
        `You purchased "${bookData[0].title}" for ${buyerPrice} credits.`,
        `/reader/${input.bookId}`
      );

      // Refresh author stats cache (fire-and-forget)
      refreshAuthorStats(bookData[0].authorId, db).catch(console.error);

      // Check sales milestones (fire-and-forget)
      const newPurchaseCount = (bookData[0].purchaseCount || 0) + 1;
      notifySalesMilestone({
        authorId: bookData[0].authorId,
        bookId: input.bookId,
        bookTitle: bookData[0].title,
        totalSales: newPurchaseCount,
      }).catch(() => {});

      return { success: true };
    }),

  // Save reading progress
  saveProgress: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        currentPageId: z.number(),
        branchPath: z.string(),
        isEndingNode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { readingProgress } = await import("../../drizzle/schema");

      const existing = await db
        .select()
        .from(readingProgress)
        .where(
          and(
            eq(readingProgress.userId, ctx.user.id),
            eq(readingProgress.bookId, input.bookId)
          )
        )
        .limit(1);

      // Only stamp completedAt once (idempotent)
      const shouldComplete = input.isEndingNode && !existing[0]?.completedAt;
      const completedAt = shouldComplete
        ? new Date()
        : (existing[0]?.completedAt ?? undefined);

      if (existing[0]) {
        await db
          .update(readingProgress)
          .set({
            currentPageId: input.currentPageId,
            branchPath: input.branchPath,
            ...(shouldComplete ? { completedAt } : {}),
          })
          .where(
            and(
              eq(readingProgress.userId, ctx.user.id),
              eq(readingProgress.bookId, input.bookId)
            )
          );
      } else {
        await db.insert(readingProgress).values({
          userId: ctx.user.id,
          bookId: input.bookId,
          currentPageId: input.currentPageId,
          branchPath: input.branchPath,
          ...(shouldComplete ? { completedAt } : {}),
        });
      }

      // If this is a new completion, refresh author stats cache (fire-and-forget)
      if (shouldComplete) {
        const [bookRow] = await db
          .select({ authorId: books.authorId })
          .from(books)
          .where(eq(books.id, input.bookId))
          .limit(1);
        if (bookRow)
          refreshAuthorStats(bookRow.authorId, db).catch(console.error);
      }

      return { success: true, completed: !!shouldComplete };
    }),

  // Get reading progress
  getProgress: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const { readingProgress } = await import("../../drizzle/schema");

      const result = await db
        .select()
        .from(readingProgress)
        .where(
          and(
            eq(readingProgress.userId, ctx.user.id),
            eq(readingProgress.bookId, input.bookId)
          )
        )
        .limit(1);

      return result[0] ?? null;
    }),

  // Leaderboard data
  leaderboard: publicProcedure
    .input(
      z.object({
        search: z.string().max(120).optional(),
        category: z.string().max(50).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return {
          bestSellers: [],
          newArrivals: [],
          mostPopular: [],
        };
      }

      const conditions = [
        eq(books.isPublished, true),
        eq(books.isDelisted, false),
        eq(books.status, "ready"),
      ];

      if (input.category)
        conditions.push(eq(books.category, input.category as any));
      if (input.search) {
        conditions.push(
          or(
            like(books.title, `%${input.search}%`),
            like(profiles.authorName, `%${input.search}%`)
          ) as any
        );
      }

      const baseQuery = db
        .select({
          book: books,
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
        })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .where(and(...conditions));

      const [bestSellers, newArrivals, mostPopular] = await Promise.all([
        db
          .select({
            book: books,
            authorName: profiles.authorName,
            authorAvatar: profiles.avatarUrl,
            authorId: books.authorId,
            prevRank: profiles.lastBestSellerRank,
          })
          .from(books)
          .leftJoin(profiles, eq(books.authorId, profiles.userId))
          .where(and(...conditions))
          .orderBy(desc(books.purchaseCount))
          .limit(20),
        db
          .select({
            book: books,
            authorName: profiles.authorName,
            authorAvatar: profiles.avatarUrl,
            authorId: books.authorId,
            prevRank: profiles.lastNewArrivalRank,
          })
          .from(books)
          .leftJoin(profiles, eq(books.authorId, profiles.userId))
          .where(and(...conditions))
          .orderBy(desc(books.createdAt))
          .limit(20),
        db
          .select({
            book: books,
            authorName: profiles.authorName,
            authorAvatar: profiles.avatarUrl,
            authorId: books.authorId,
            prevRank: profiles.lastMostPopularRank,
          })
          .from(books)
          .leftJoin(profiles, eq(books.authorId, profiles.userId))
          .where(and(...conditions))
          .orderBy(desc(books.reviewCount))
          .limit(20),
      ]);

      // Compute rank deltas and annotate results
      const annotate = (
        rows: typeof bestSellers,
        rankField:
          | "lastBestSellerRank"
          | "lastNewArrivalRank"
          | "lastMostPopularRank"
      ) =>
        rows.map((row, idx) => {
          const currentRank = idx + 1;
          const prevRank = row.prevRank ?? null;
          const rankChange = prevRank !== null ? prevRank - currentRank : null; // positive = moved up
          return { ...row, rankChange };
        });

      const annotatedBestSellers = annotate(bestSellers, "lastBestSellerRank");
      const annotatedNewArrivals = annotate(newArrivals, "lastNewArrivalRank");
      const annotatedMostPopular = annotate(mostPopular, "lastMostPopularRank");

      // Write-through rank snapshots (fire-and-forget)
      const updateRanks = async () => {
        const now = new Date();
        const updates: Promise<any>[] = [];
        bestSellers.forEach((row, idx) => {
          updates.push(
            db
              .update(profiles)
              .set({ lastBestSellerRank: idx + 1, lastRankSnapshotAt: now })
              .where(eq(profiles.userId, row.authorId))
          );
        });
        newArrivals.forEach((row, idx) => {
          updates.push(
            db
              .update(profiles)
              .set({ lastNewArrivalRank: idx + 1, lastRankSnapshotAt: now })
              .where(eq(profiles.userId, row.authorId))
          );
        });
        mostPopular.forEach((row, idx) => {
          updates.push(
            db
              .update(profiles)
              .set({ lastMostPopularRank: idx + 1, lastRankSnapshotAt: now })
              .where(eq(profiles.userId, row.authorId))
          );
        });
        await Promise.allSettled(updates);
      };
      updateRanks().catch(() => {}); // fire-and-forget

      // Dispatch leaderboard notifications (fire-and-forget)
      const dispatchNotifs = async () => {
        const toItems = (rows: typeof annotatedBestSellers) =>
          rows.map(r => ({
            authorId: r.authorId,
            bookId: r.book.id,
            bookTitle: r.book.title,
            newRank: rows.indexOf(r) + 1,
            previousRank: r.prevRank ?? null,
          }));
        await Promise.allSettled([
          dispatchLeaderboardNotifications({
            listType: "bestSellers",
            rankedItems: toItems(annotatedBestSellers),
          }),
          dispatchLeaderboardNotifications({
            listType: "newArrivals",
            rankedItems: toItems(annotatedNewArrivals),
          }),
          dispatchLeaderboardNotifications({
            listType: "mostPopular",
            rankedItems: toItems(annotatedMostPopular),
          }),
        ]);
      };
      dispatchNotifs().catch(() => {});

      return {
        bestSellers: annotatedBestSellers,
        newArrivals: annotatedNewArrivals,
        mostPopular: annotatedMostPopular,
      };
    }),

  // Get author profile (public)
  getAuthorProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select({
          profile: profiles,
          userId: users.id,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, input.userId))
        .limit(1);

      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });

      // Aggregate stats from published books
      const statsResult = await db
        .select({
          totalBooks: count(books.id),
          totalSales: sql<number>`COALESCE(SUM(${books.purchaseCount}), 0)`,
          totalReviews: sql<number>`COALESCE(SUM(${books.reviewCount}), 0)`,
          avgRating: sql<number>`COALESCE(AVG(NULLIF(${books.averageRating}, 0)), 0)`,
        })
        .from(books)
        .where(
          and(
            eq(books.authorId, input.userId),
            eq(books.isPublished, true),
            eq(books.isDelisted, false)
          )
        );

      // Total completions across all author's books
      const { readingProgress } = await import("../../drizzle/schema");
      const completionsResult = await db
        .select({ total: count(readingProgress.id) })
        .from(readingProgress)
        .innerJoin(
          books,
          and(
            eq(readingProgress.bookId, books.id),
            eq(books.authorId, input.userId),
            eq(books.isPublished, true),
            eq(books.isDelisted, false)
          )
        )
        .where(sql`${readingProgress.completedAt} IS NOT NULL`);

      const stats = statsResult[0] ?? {
        totalBooks: 0,
        totalSales: 0,
        totalReviews: 0,
        avgRating: 0,
      };
      const totalCompletions = Number(completionsResult[0]?.total ?? 0);

      return {
        ...result[0],
        stats: {
          totalBooks: Number(stats.totalBooks),
          totalSales: Number(stats.totalSales),
          totalReviews: Number(stats.totalReviews),
          avgRating: Number(Number(stats.avgRating).toFixed(1)),
          totalCompletions,
        },
      };
    }),

  // Get author's books
  authorBooks: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { readingProgress } = await import("../../drizzle/schema");

      // Get books with per-book completion count
      const bookRows = await db
        .select({
          book: books,
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
        })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .where(
          and(
            eq(books.authorId, input.userId),
            eq(books.isPublished, true),
            eq(books.isDelisted, false)
          )
        )
        .orderBy(desc(books.createdAt));

      if (bookRows.length === 0) return [];

      const bookIds = bookRows.map(r => r.book.id);

      // Count completions per book
      const completionCounts = await db
        .select({
          bookId: readingProgress.bookId,
          completedReaders: count(readingProgress.id),
        })
        .from(readingProgress)
        .where(
          and(
            inArray(readingProgress.bookId, bookIds),
            sql`${readingProgress.completedAt} IS NOT NULL`
          )
        )
        .groupBy(readingProgress.bookId);

      const completionMap = new Map(
        completionCounts.map(c => [c.bookId, Number(c.completedReaders)])
      );

      return bookRows.map(row => ({
        ...row,
        completedReaders: completionMap.get(row.book.id) ?? 0,
      }));
    }),

  // Get full book detail for the store detail page
  getDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select({
          book: books,
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
          authorId: users.id,
        })
        .from(books)
        .leftJoin(users, eq(books.authorId, users.id))
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .where(
          and(
            eq(books.id, input.id),
            eq(books.isPublished, true),
            eq(books.isDelisted, false)
          )
        )
        .limit(1);

      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });

      // Get active campaigns and check if this book's category is targeted
      const activeCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.isActive, true));

      const bookCategory = result[0].book.category ?? "";
      const matchingCampaign =
        activeCampaigns.find(c => {
          const targets = Array.isArray(c.targetCategories)
            ? (c.targetCategories as string[])
            : [];
          return targets.includes(bookCategory) || targets.includes("all");
        }) ?? null;

      let discountedPrice: number | null = null;
      const bookData = result[0];
      const storePrice = bookData.book.storePrice ?? 0;
      if (matchingCampaign) {
        if (matchingCampaign.discountType === "percent") {
          discountedPrice = Math.round(
            storePrice * (1 - matchingCampaign.discountValue / 100)
          );
        } else {
          discountedPrice = Math.max(
            0,
            storePrice - matchingCampaign.discountValue
          );
        }
      }

      return {
        ...result[0],
        hasCampaign: !!matchingCampaign,
        discountedPrice,
      };
    }),

  // Retry a failed book generation
  retryGeneration: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.status === "suspended" || ctx.user.accountLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.accountLocked
            ? "Account locked due to payment issue. Please contact support."
            : "Account suspended",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const bookRows = await db
        .select()
        .from(books)
        .where(eq(books.id, input.bookId))
        .limit(1);
      const book = bookRows[0];
      if (!book) throw new TRPCError({ code: "NOT_FOUND" });
      if (book.authorId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (book.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Book is not in failed state.",
        });
      }

      // Reset book status and create a new job
      await db
        .update(books)
        .set({ status: "generating" })
        .where(eq(books.id, input.bookId));
      const [jobInsertResult] = await db
        .insert(generationJobs)
        .values({ bookId: input.bookId });
      const jobId = (jobInsertResult as any)?.insertId as number | undefined;
      if (jobId) {
        await db
          .update(generationJobs)
          .set({ status: "generating", startedAt: new Date() })
          .where(eq(generationJobs.id, jobId));
      }

      // Fetch characters for regeneration
      const chars = await db
        .select()
        .from(bookCharacters)
        .where(eq(bookCharacters.bookId, input.bookId));

      // Start regeneration via lease-based worker (double-processing safe)
      if (jobId) {
        const userId = ctx.user.id;
        const bookTitle = book.title;
        const bookIdForClosure = input.bookId;
        claimAndRunJob(
          jobId,
          input.bookId,
          {
            title: book.title,
            category: book.category,
            length: book.length,
            description: book.description ?? "",
            language: book.bookLanguage,
            characters: chars.map(c => ({
              name: c.name,
              photoUrl: c.photoUrl ?? undefined,
            })),
          },
          db,
          async (bid, data) => {
            await generateBookContent(bid, data);
            const updatedBook = await db
              .select()
              .from(books)
              .where(eq(books.id, bookIdForClosure))
              .limit(1);
            if (updatedBook[0]?.status === "ready") {
              await createNotification(
                userId,
                "book_ready",
                "Book Regeneration Complete!",
                `Your book "${bookTitle}" has been regenerated successfully.`,
                `/reader/${bookIdForClosure}`
              );
            }
          }
        ).catch(console.error);
      }

      return {
        bookId: input.bookId,
        jobId: jobId ?? null,
        status: "generating",
      };
    }),

  // Public: get admin-curated featured gamebooks; falls back to top 8 by purchaseCount
  getFeatured: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Try admin-curated featured books first
    const featured = await db
      .select({
        book: books,
        authorName: profiles.authorName,
        authorAvatar: profiles.avatarUrl,
      })
      .from(books)
      .leftJoin(profiles, eq(books.authorId, profiles.userId))
      .where(
        and(
          eq(books.isFeatured, true),
          eq(books.isPublished, true),
          eq(books.isDelisted, false),
          eq(books.status, "ready")
        )
      )
      .orderBy(asc(books.featuredOrder))
      .limit(12);

    if (featured.length > 0) return featured;

    // Fallback: top 8 by purchaseCount
    return db
      .select({
        book: books,
        authorName: profiles.authorName,
        authorAvatar: profiles.avatarUrl,
      })
      .from(books)
      .leftJoin(profiles, eq(books.authorId, profiles.userId))
      .where(
        and(
          eq(books.isPublished, true),
          eq(books.isDelisted, false),
          eq(books.status, "ready")
        )
      )
      .orderBy(desc(books.purchaseCount))
      .limit(8);
  }),

  /**
   * deleteBook  author-only soft-delete.
   * Sets status="deleted" and isDelisted=true so the book:
   *   - disappears from the Store (isDelisted=true / status=deleted)
   *   - disappears from the author's own Library view
   *   - remains accessible to any user who already purchased it (userBooks rows untouched)
   */
  deleteBook: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify the caller is the author
      const [book] = await db
        .select({ authorId: books.authorId, status: books.status })
        .from(books)
        .where(eq(books.id, input.bookId))
        .limit(1);

      if (!book)
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      if (book.authorId !== ctx.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author can delete this book",
        });
      if (book.status === "deleted") return { success: true }; // already deleted

      await db
        .update(books)
        .set({ status: "deleted", isDelisted: true })
        .where(eq(books.id, input.bookId));

      console.log(
        `[Books] Book ${input.bookId} soft-deleted by author ${ctx.user.id}`
      );
      return { success: true };
    }),
});
