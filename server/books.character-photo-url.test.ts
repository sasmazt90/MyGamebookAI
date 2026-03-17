import { describe, expect, it } from "vitest";
import { normaliseCharacterPhotoUrl } from "./routers/books";

describe("normaliseCharacterPhotoUrl", () => {
  it("converts drive preview URL to downloadable googleusercontent URL", () => {
    const result = normaliseCharacterPhotoUrl("https://drive.google.com/file/d/1_Q1kF0bWIrKlbiwC24julKGukgx5hOab/preview");
    expect(result).toBe("https://drive.usercontent.google.com/download?id=1_Q1kF0bWIrKlbiwC24julKGukgx5hOab&export=download&confirm=t");
  });

  it("converts drive open?id URL to downloadable googleusercontent URL", () => {
    const result = normaliseCharacterPhotoUrl("https://drive.google.com/open?id=1Zpr_-ZioZuFDj_bi1rXWBNAxDK9_KqIi");
    expect(result).toBe("https://drive.usercontent.google.com/download?id=1Zpr_-ZioZuFDj_bi1rXWBNAxDK9_KqIi&export=download&confirm=t");
  });

  it("leaves non-drive URLs unchanged", () => {
    const source = "https://example.com/image.png";
    expect(normaliseCharacterPhotoUrl(source)).toBe(source);
  });
});
