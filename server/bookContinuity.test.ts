import { describe, expect, it } from "vitest";

import {
  branchSimilarityScore,
  buildScenePrompt,
  createBookVisualBlueprint,
  createCanonicalCharacterProfiles,
  type SceneSpec,
} from "./bookContinuity";

describe("book continuity helpers", () => {
  it("builds canonical character locks that preserve identity, age, and clothing", () => {
    const profiles = createCanonicalCharacterProfiles(
      [
        {
          name: "Mina",
          role: "protagonist",
          voice: "Curious and brave.",
          appearance:
            "AGE: child, around seven years old. CLOTHING: yellow raincoat with silver boots and a moon pin. Oval face with bright brown eyes.",
          photoUrl: "https://example.com/mina.jpg",
        },
      ],
      {
        Mina: {
          skin_tone: "warm olive",
          face_shape: "oval with soft jaw",
          hair_colour: "dark brown",
          hair_style: "shoulder-length wavy bob",
          eye_colour: "brown",
          eye_shape: "round expressive eyes",
          nose_shape: "small straight nose",
          eyebrows: "soft dark brows",
          body_shape: "small child build",
          facial_hair: "none",
          distinctive: "freckles",
          prose_summary: "A child with freckles and a warm smile.",
          age_band: "child",
          age_detail: "approximately seven years old",
        },
      }
    );

    expect(profiles[0]?.ageLock.toLowerCase()).toContain("child");
    expect(profiles[0]?.clothingLock.toLowerCase()).toContain("yellow raincoat");
    expect(profiles[0]?.identityLock.toLowerCase()).toContain("likeness");
  });

  it("builds a scene prompt that hard-locks no-text, framing, and recurring entities", () => {
    const blueprint = createBookVisualBlueprint({
      readablePathLength: 10,
      graphPageCount: 16,
      styleLock: "storybook lighting and gouache rendering",
      characterProfiles: [
        {
          name: "Mina",
          role: "protagonist",
          voice: "Curious and brave.",
          appearance: "Child in a yellow raincoat.",
          ageLock: "child",
          clothingLock: "yellow raincoat",
          identityLock: "Identity anchor for Mina. If style conflicts with likeness, likeness wins.",
          promptBlock: "Mina | child | yellow raincoat",
        },
      ],
      recurringObjects: [
        {
          name: "Moon Rocket",
          canonicalAppearance: "small silver rocket with crescent-shaped fins",
          invariants: ["silver hull", "crescent fins", "round porthole"],
        },
      ],
    });

    const spec: SceneSpec = {
      pageNumber: 4,
      sceneSummary: "Mina boards the Moon Rocket beside the glowing oak tree.",
      narrativeBeat: "She commits to the journey.",
      location: "forest clearing",
      environment: "glowing oak tree and moonlit grass",
      timeOfDay: "night",
      lighting: "moonlight with lantern glow",
      physics: "consistent moonlight shadows and grounded scale",
      camera: "medium-wide shot",
      composition: "subjects fully visible",
      continuityFromPrevious: "Continue from the same clearing used on the previous page.",
      branchDelta: "Show that Mina chose the adventurous route.",
      mustShow: ["Mina stepping into the rocket", "glowing oak tree"],
      explicitExclusions: ["text", "captions"],
      characters: [
        {
          name: "Mina",
          action: "steps into the rocket",
          pose: "one foot on the ladder",
          framing: "full body",
          visibility: "fully visible",
        },
      ],
      recurringObjects: [
        {
          name: "Moon Rocket",
          state: "ready for launch",
          visibility: "fully visible",
        },
      ],
    };

    const prompt = buildScenePrompt({
      blueprint,
      sceneSpec: spec,
      pageKind: "page",
    });

    expect(prompt).toContain("STRICT NO-TEXT RULE");
    expect(prompt).toContain("Moon Rocket");
    expect(prompt).toContain("Mina");
    expect(prompt.toLowerCase()).toContain("fully visible");
  });

  it("detects shallow branch divergence with token overlap", () => {
    const similarity = branchSimilarityScore(
      "Mina quietly walks down the lantern path into the same garden.",
      "Mina quietly walks down the lantern path into the same garden again."
    );

    expect(similarity).toBeGreaterThan(0.6);
  });
});
