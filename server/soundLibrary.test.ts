import { describe, expect, it } from "vitest";

import { findBestSound, type SoundEntry } from "../shared/soundLibrary";

const entries: SoundEntry[] = [
  { category: "science_fiction", sound: "rocket engine launch", url: "rocket-url" },
  { category: "doors", sound: "heavy door creak", url: "door-url" },
  { category: "ambiences", sound: "forest wind birds", url: "forest-url" },
  { category: "human_voices", sound: "gentle piano music", url: "music-url" },
];

describe("sound library matching", () => {
  it("prioritises canonical sfx tags over page language", () => {
    const url = findBestSound(
      entries,
      "Kahraman sessizce kapidan gecti ve sonra roketi gordu.",
      ["rocket_launch"],
      "fantasy_scifi"
    );

    expect(url).toBe("rocket-url");
  });

  it("still supports content fallback when tags are generic", () => {
    const url = findBestSound(
      entries,
      "They stepped into the forest and heard birds in the wind.",
      ["ambience"],
      "fairy_tale"
    );

    expect(url).toBe("forest-url");
  });

  it("uses the same canonical tag match for non-English content", () => {
    const url = findBestSound(
      entries,
      "Sie offneten langsam die Tur und hielten den Atem an.",
      ["door_creak"],
      "crime_mystery"
    );

    expect(url).toBe("door-url");
  });
});
