import { describe, expect, it } from "vitest";

import {
  createBookVisualBlueprint,
  createCanonicalCharacterProfiles,
  selectReferenceImages,
  type SceneSpec,
} from "./bookContinuity";

describe("book continuity reference selection", () => {
  it("returns illustrated portraits before raw photos for named characters", () => {
    const blueprint = createBookVisualBlueprint({
      readablePathLength: 10,
      graphPageCount: 16,
      styleLock: "storybook",
      characterProfiles: createCanonicalCharacterProfiles(
        [
          {
            name: "Tolgar",
            appearance: "adult hero in a navy shirt",
            voice: "warm",
            role: "protagonist",
            photoUrl: "https://example.com/tolgar.jpg",
          },
        ],
        {
          Tolgar: {
            skin_tone: "medium tan",
            face_shape: "oval",
            hair_colour: "brown",
            hair_style: "short",
            eye_colour: "brown",
            eye_shape: "round",
            nose_shape: "straight",
            eyebrows: "thick",
            body_shape: "lean",
            facial_hair: "none",
            distinctive: "none",
            outfit_summary: "navy shirt, tan trousers",
            accessories: "silver watch",
            headwear: "none",
            prose_summary: "test",
          },
        }
      ),
      recurringObjects: [],
    });

    const sceneSpec: SceneSpec = {
      pageNumber: 1,
      sceneSummary: "Tolgar looks at the moon.",
      narrativeBeat: "Opening",
      location: "bedroom",
      environment: "night",
      timeOfDay: "night",
      lighting: "moonlight",
      physics: "normal",
      camera: "medium",
      composition: "clear",
      continuityFromPrevious: "",
      branchDelta: "",
      mustShow: [],
      explicitExclusions: [],
      characters: [
        {
          name: "Tolgar",
          action: "pointing",
          pose: "standing",
          framing: "full",
          visibility: "visible",
        },
      ],
      recurringObjects: [],
    };

    const refs = selectReferenceImages({
      sceneSpec,
      blueprint,
      portraitRefs: new Map([
        ["Tolgar", { url: "https://example.com/tolgar-portrait.png", mimeType: "image/png" }],
      ]),
      photoRefs: new Map([
        ["Tolgar", { url: "https://example.com/tolgar-photo.jpg", mimeType: "image/jpeg" }],
      ]),
    });

    expect(refs.map((ref) => ref.url)).toEqual([
      "https://example.com/tolgar-portrait.png",
      "https://example.com/tolgar-photo.jpg",
    ]);
  });
});
