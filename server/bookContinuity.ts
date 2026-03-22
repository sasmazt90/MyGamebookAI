type CharacterCardInput = {
  name: string;
  appearance: string;
  voice: string;
  role: string;
  photoUrl?: string;
};

type PhotoAnalysisInput = {
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
  prose_summary: string;
  age_band?: string;
  age_detail?: string;
};

export type CanonicalCharacterProfile = {
  name: string;
  role: string;
  voice: string;
  appearance: string;
  photoUrl?: string;
  ageLock: string;
  clothingLock: string;
  identityLock: string;
  promptBlock: string;
};

export type RecurringObjectProfile = {
  name: string;
  canonicalAppearance: string;
  invariants: string[];
  continuityRole?: string;
  firstSeenPage?: number;
};

export type SceneCharacterState = {
  name: string;
  action: string;
  pose: string;
  framing: string;
  visibility: string;
};

export type SceneObjectState = {
  name: string;
  state: string;
  visibility: string;
};

export type SceneSpec = {
  pageNumber: number;
  sceneSummary: string;
  narrativeBeat: string;
  location: string;
  environment: string;
  timeOfDay: string;
  lighting: string;
  physics: string;
  camera: string;
  composition: string;
  continuityFromPrevious: string;
  branchDelta: string;
  mustShow: string[];
  explicitExclusions: string[];
  characters: SceneCharacterState[];
  recurringObjects: SceneObjectState[];
};

export type BookVisualBlueprint = {
  readablePathLength: number;
  graphPageCount: number;
  globalStyleLock: string;
  noTextRule: string;
  framingRules: string;
  characterProfiles: CanonicalCharacterProfile[];
  recurringObjects: RecurringObjectProfile[];
};

export type ReferenceImage = {
  url?: string;
  b64Json?: string;
  mimeType?: string;
};

const NO_TEXT_RULE =
  "STRICT NO-TEXT RULE: no text, no letters, no words, no numbers, no captions, no symbols, no signage, no logos, no interface elements, no overlays, no watermarks anywhere in the image.";

function squashWhitespace(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function firstMatchingSentence(appearance: string, label: string): string {
  const sentence = squashWhitespace(appearance)
    .split(/(?<=[.!?])\s+/)
    .find((part) => part.toLowerCase().includes(label.toLowerCase()));
  return sentence ? sentence.trim() : "";
}

function extractLifeStage(appearance: string, photo: PhotoAnalysisInput | undefined): string {
  const explicitAge =
    firstMatchingSentence(appearance, "AGE") ||
    firstMatchingSentence(appearance, "age") ||
    squashWhitespace(photo?.age_band) ||
    squashWhitespace(photo?.age_detail);

  if (explicitAge) {
    return explicitAge;
  }

  const lowered = appearance.toLowerCase();
  if (/\bchild|young child|little\b/.test(lowered)) return "child; keep the same child age and physical maturity in every scene";
  if (/\bteen|teenager|adolescent\b/.test(lowered)) return "teenager; keep the same teenage age and physical maturity in every scene";
  if (/\byoung adult|adult|grown\b/.test(lowered)) return "adult; keep the same adult age and physical maturity in every scene";
  return "keep the same age impression and physical maturity in every scene";
}

function extractClothingLock(appearance: string, photo: PhotoAnalysisInput | undefined): string {
  const explicit = firstMatchingSentence(appearance, "CLOTHING") || firstMatchingSentence(appearance, "outfit");
  const outfitFromPhoto = squashWhitespace(photo?.outfit_summary);
  const accessories = squashWhitespace(photo?.accessories);
  const headwear = squashWhitespace(photo?.headwear);

  if (explicit) return explicit;
  if (outfitFromPhoto || accessories || headwear) {
    return [
      outfitFromPhoto ? `Preserve this exact outfit from the reference: ${outfitFromPhoto}.` : "",
      accessories && accessories.toLowerCase() !== "none"
        ? `Keep the same accessories: ${accessories}.`
        : "",
      headwear && headwear.toLowerCase() !== "none"
        ? `Keep the same headwear/hair accessory: ${headwear}.`
        : "",
      "Do not change clothing colours, garments, accessories, or silhouette between pages.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "Preserve the exact same outfit, accessories, and colour arrangement unless the story explicitly changes clothing.";
}

function buildIdentityLock(card: CharacterCardInput, photo: PhotoAnalysisInput | undefined): string {
  const axes = [
    photo?.skin_tone ? `skin tone: ${photo.skin_tone}` : "",
    photo?.face_shape ? `face shape: ${photo.face_shape}` : "",
    photo?.hair_colour ? `hair colour: ${photo.hair_colour}` : "",
    photo?.hair_style ? `hair style: ${photo.hair_style}` : "",
    photo?.eye_colour ? `eye colour: ${photo.eye_colour}` : "",
    photo?.eye_shape ? `eye shape: ${photo.eye_shape}` : "",
    photo?.nose_shape ? `nose shape: ${photo.nose_shape}` : "",
    photo?.eyebrows ? `eyebrows: ${photo.eyebrows}` : "",
    photo?.body_shape ? `body build: ${photo.body_shape}` : "",
    photo?.facial_hair && photo.facial_hair.toLowerCase() !== "none" ? `facial hair: ${photo.facial_hair}` : "",
    photo?.distinctive && photo.distinctive.toLowerCase() !== "none" ? `distinctive traits: ${photo.distinctive}` : "",
    photo?.outfit_summary ? `outfit: ${photo.outfit_summary}` : "",
    photo?.accessories && photo.accessories.toLowerCase() !== "none" ? `accessories: ${photo.accessories}` : "",
    photo?.headwear && photo.headwear.toLowerCase() !== "none" ? `headwear: ${photo.headwear}` : "",
  ].filter(Boolean);

  const identityAxes = axes.length > 0 ? axes.join("; ") : squashWhitespace(card.appearance);
  return [
    `Identity anchor for ${card.name}: ${identityAxes}.`,
    "Never reinterpret this person between pages.",
    "If style conflicts with likeness, likeness wins.",
  ].join(" ");
}

export function createCanonicalCharacterProfiles(
  characterCards: CharacterCardInput[],
  photoAnalyses: Record<string, PhotoAnalysisInput>
): CanonicalCharacterProfile[] {
  return characterCards.map((card) => {
    const photo = photoAnalyses[card.name];
    const ageLock = extractLifeStage(card.appearance, photo);
    const clothingLock = extractClothingLock(card.appearance, photo);
    const identityLock = buildIdentityLock(card, photo);
    const promptBlock = [
      `${card.name} (${card.role})`,
      `Appearance: ${squashWhitespace(card.appearance)}`,
      `Age lock: ${ageLock}`,
      `Clothing lock: ${clothingLock}`,
      identityLock,
    ].join(" | ");

    return {
      name: card.name,
      role: card.role,
      voice: card.voice,
      appearance: card.appearance,
      photoUrl: card.photoUrl,
      ageLock,
      clothingLock,
      identityLock,
      promptBlock,
    };
  });
}

export function createBookVisualBlueprint(input: {
  readablePathLength: number;
  graphPageCount: number;
  styleLock: string;
  characterProfiles: CanonicalCharacterProfile[];
  recurringObjects: RecurringObjectProfile[];
}): BookVisualBlueprint {
  return {
    readablePathLength: input.readablePathLength,
    graphPageCount: input.graphPageCount,
    globalStyleLock: squashWhitespace(input.styleLock),
    noTextRule: NO_TEXT_RULE,
    framingRules:
      "Framing lock: keep primary subjects fully visible, avoid awkward crops, preserve readable silhouettes, and use stable composition across consecutive scenes.",
    characterProfiles: input.characterProfiles,
    recurringObjects: input.recurringObjects,
  };
}

export function buildRecurringObjectLock(
  blueprint: BookVisualBlueprint,
  objectNames: string[]
): string {
  const wanted = new Set(objectNames.map((value) => value.toLowerCase()));
  const objects = blueprint.recurringObjects.filter((object) => wanted.has(object.name.toLowerCase()));
  if (objects.length === 0) return "";

  return [
    "Recurring object lock:",
    ...objects.map((object) =>
      `${object.name}: ${object.canonicalAppearance}. Invariants: ${object.invariants.join(", ")}`
    ),
  ].join(" | ");
}

export function buildCharacterLock(
  blueprint: BookVisualBlueprint,
  characterNames: string[]
): string {
  const wanted = new Set(characterNames.map((value) => value.toLowerCase()));
  const characters = blueprint.characterProfiles.filter((profile) => wanted.has(profile.name.toLowerCase()));
  if (characters.length === 0) return "";

  return [
    "Canonical character lock:",
    ...characters.map((profile) => profile.promptBlock),
  ].join(" | ");
}

export function sceneSpecFallback(input: {
  pageNumber: number;
  narrative: string;
  previousScene?: SceneSpec;
  blueprint: BookVisualBlueprint;
}): SceneSpec {
  const narrative = squashWhitespace(input.narrative);
  return {
    pageNumber: input.pageNumber,
    sceneSummary: narrative.slice(0, 280) || `Scene for page ${input.pageNumber}`,
    narrativeBeat: narrative.slice(0, 180) || "Continue the current story moment.",
    location: input.previousScene?.location || "same location as previous scene unless the story explicitly moves elsewhere",
    environment: input.previousScene?.environment || "continue the current environment faithfully",
    timeOfDay: input.previousScene?.timeOfDay || "match the current story time",
    lighting: input.previousScene?.lighting || "physically consistent lighting based on the active environment and time of day",
    physics: "keep gravity, weather, shadows, scale, and surface interactions physically believable",
    camera: "stable medium-wide storybook framing with fully visible subjects",
    composition: input.blueprint.framingRules,
    continuityFromPrevious:
      input.previousScene?.sceneSummary
        ? `Continue from previous illustrated scene: ${input.previousScene.sceneSummary}`
        : "Establish the scene clearly with strong continuity anchors.",
    branchDelta: "If this page follows a branch choice, show the chosen outcome explicitly in the environment and character actions.",
    mustShow: [narrative.slice(0, 180)].filter(Boolean),
    explicitExclusions: ["text", "letters", "symbols", "captions", "logos", "interface overlays"],
    characters: [],
    recurringObjects: [],
  };
}

export function parseSceneSpecResponse(
  raw: string,
  fallback: SceneSpec
): SceneSpec {
  try {
    const parsed = JSON.parse(raw) as Partial<SceneSpec>;
    return {
      pageNumber: parsed.pageNumber ?? fallback.pageNumber,
      sceneSummary: squashWhitespace(parsed.sceneSummary) || fallback.sceneSummary,
      narrativeBeat: squashWhitespace(parsed.narrativeBeat) || fallback.narrativeBeat,
      location: squashWhitespace(parsed.location) || fallback.location,
      environment: squashWhitespace(parsed.environment) || fallback.environment,
      timeOfDay: squashWhitespace(parsed.timeOfDay) || fallback.timeOfDay,
      lighting: squashWhitespace(parsed.lighting) || fallback.lighting,
      physics: squashWhitespace(parsed.physics) || fallback.physics,
      camera: squashWhitespace(parsed.camera) || fallback.camera,
      composition: squashWhitespace(parsed.composition) || fallback.composition,
      continuityFromPrevious:
        squashWhitespace(parsed.continuityFromPrevious) || fallback.continuityFromPrevious,
      branchDelta: squashWhitespace(parsed.branchDelta) || fallback.branchDelta,
      mustShow: Array.isArray(parsed.mustShow)
        ? parsed.mustShow.map((value) => squashWhitespace(String(value))).filter(Boolean)
        : fallback.mustShow,
      explicitExclusions: Array.isArray(parsed.explicitExclusions)
        ? parsed.explicitExclusions.map((value) => squashWhitespace(String(value))).filter(Boolean)
        : fallback.explicitExclusions,
      characters: Array.isArray(parsed.characters)
        ? parsed.characters.map((item) => ({
            name: squashWhitespace(String(item?.name ?? "")),
            action: squashWhitespace(String(item?.action ?? "")),
            pose: squashWhitespace(String(item?.pose ?? "")),
            framing: squashWhitespace(String(item?.framing ?? "")),
            visibility: squashWhitespace(String(item?.visibility ?? "")),
          })).filter((item) => item.name)
        : fallback.characters,
      recurringObjects: Array.isArray(parsed.recurringObjects)
        ? parsed.recurringObjects.map((item) => ({
            name: squashWhitespace(String(item?.name ?? "")),
            state: squashWhitespace(String(item?.state ?? "")),
            visibility: squashWhitespace(String(item?.visibility ?? "")),
          })).filter((item) => item.name)
        : fallback.recurringObjects,
    };
  } catch {
    return fallback;
  }
}

export function buildScenePrompt(input: {
  blueprint: BookVisualBlueprint;
  sceneSpec: SceneSpec;
  pageKind: "cover" | "page" | "comic";
}): string {
  const characterNames = input.sceneSpec.characters.map((character) => character.name);
  const objectNames = input.sceneSpec.recurringObjects.map((object) => object.name);

  return [
    input.blueprint.globalStyleLock,
    input.blueprint.noTextRule,
    input.blueprint.framingRules,
    buildCharacterLock(input.blueprint, characterNames),
    buildRecurringObjectLock(input.blueprint, objectNames),
    `Scene kind: ${input.pageKind}`,
    `Scene summary: ${input.sceneSpec.sceneSummary}`,
    `Narrative beat: ${input.sceneSpec.narrativeBeat}`,
    `Location: ${input.sceneSpec.location}`,
    `Environment: ${input.sceneSpec.environment}`,
    `Time of day: ${input.sceneSpec.timeOfDay}`,
    `Lighting: ${input.sceneSpec.lighting}`,
    `Physics: ${input.sceneSpec.physics}`,
    `Camera: ${input.sceneSpec.camera}`,
    `Composition: ${input.sceneSpec.composition}`,
    `Continuity: ${input.sceneSpec.continuityFromPrevious}`,
    `Branch consequence: ${input.sceneSpec.branchDelta}`,
    input.sceneSpec.mustShow.length > 0 ? `Must show: ${input.sceneSpec.mustShow.join("; ")}` : "",
    input.sceneSpec.explicitExclusions.length > 0
      ? `Do not show: ${input.sceneSpec.explicitExclusions.join(", ")}`
      : "",
    input.sceneSpec.characters.length > 0
      ? `Character staging: ${input.sceneSpec.characters
          .map((character) =>
            `${character.name} action=${character.action}; pose=${character.pose}; framing=${character.framing}; visibility=${character.visibility}`
          )
          .join(" | ")}`
      : "",
    input.sceneSpec.recurringObjects.length > 0
      ? `Object staging: ${input.sceneSpec.recurringObjects
          .map((object) => `${object.name} state=${object.state}; visibility=${object.visibility}`)
          .join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export function selectReferenceImages(input: {
  sceneSpec: SceneSpec;
  blueprint: BookVisualBlueprint;
  portraitRefs: Map<string, ReferenceImage>;
  photoRefs: Map<string, ReferenceImage>;
}): ReferenceImage[] {
  const names = new Set(
    input.sceneSpec.characters.map((character) => character.name.toLowerCase())
  );

  if (names.size === 0) {
    return Array.from(
      new Map(
        [
          ...Array.from(input.portraitRefs.values()),
          ...Array.from(input.photoRefs.values()),
        ]
          .filter((ref) => !!ref.url || !!ref.b64Json)
          .map((ref) => [`${ref.url ?? ""}|${ref.b64Json ?? ""}`, ref])
      ).values()
    );
  }

  const refs: ReferenceImage[] = [];
  for (const profile of input.blueprint.characterProfiles) {
    if (!names.has(profile.name.toLowerCase())) continue;
    const portrait = input.portraitRefs.get(profile.name);
    if (portrait) refs.push(portrait);
    const raw = input.photoRefs.get(profile.name);
    if (raw) refs.push(raw);
  }

  return Array.from(
    new Map(
      refs
        .filter((ref) => !!ref.url || !!ref.b64Json)
        .map((ref) => [`${ref.url ?? ""}|${ref.b64Json ?? ""}`, ref])
    ).values()
  );
}

export function branchSimilarityScore(left: string, right: string): number {
  const leftTokens = new Set(
    squashWhitespace(left)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
  const rightTokens = new Set(
    squashWhitespace(right)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }

  return shared / Math.max(leftTokens.size, rightTokens.size);
}

export function getNoTextRule(): string {
  return NO_TEXT_RULE;
}
