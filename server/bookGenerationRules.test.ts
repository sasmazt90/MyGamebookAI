import { describe, expect, it } from "vitest";

import {
  getAllowedLengthsForCategory,
  getBookGenerationRule,
  getBookPresentationRule,
  getDefaultLengthForCategory,
  getPageCountLabel,
} from "../shared/bookGenerationRules";

describe("bookGenerationRules", () => {
  it("exposes the expected category-length matrix", () => {
    expect(getAllowedLengthsForCategory("fairy_tale")).toEqual(["thin"]);
    expect(getAllowedLengthsForCategory("comic")).toEqual(["thin", "normal"]);
    expect(getAllowedLengthsForCategory("romance")).toEqual(["normal", "thick"]);
  });

  it("keeps generation targets aligned with the product spec", () => {
    expect(getBookGenerationRule("fairy_tale", "thin")).toMatchObject({
      readablePathLength: 10,
      branchCount: 3,
      targetBranchDepths: [3, 6, 9],
      branchImageCount: 0,
      graphPageCount: 22,
      imageCallCount: 11,
      renderedVisualCount: 11,
    });

    expect(getBookGenerationRule("comic", "normal")).toMatchObject({
      readablePathLength: 18,
      branchCount: 4,
      targetBranchDepths: [4, 8, 12, 16],
      branchImageCount: 0,
      graphPageCount: 50,
      imageCallCount: 19,
      renderedVisualCount: 55,
    });

    expect(getBookGenerationRule("fantasy_scifi", "thick")).toMatchObject({
      readablePathLength: 120,
      branchCount: 10,
      targetBranchDepths: [8, 20, 32, 44, 56, 68, 80, 92, 104, 116],
      branchImageCount: 10,
      graphPageCount: 700,
      imageCallCount: 11,
      renderedVisualCount: 11,
    });
  });

  it("provides page labels and default lengths from the same source of truth", () => {
    expect(getDefaultLengthForCategory("comic")).toBe("thin");
    expect(getDefaultLengthForCategory("crime_mystery")).toBe("normal");
    expect(getPageCountLabel("comic", "normal")).toBe("18 pages");
    expect(getPageCountLabel("romance", "thick")).toBe("120 pages");
  });

  it("exposes category-specific reader presentation rules", () => {
    expect(getBookPresentationRule("fairy_tale")).toEqual({
      readerLayout: "storybook-single",
      flipAnimation: "storybook",
      pageTurnSound: "storybook",
    });

    expect(getBookPresentationRule("comic")).toEqual({
      readerLayout: "comic-panels",
      flipAnimation: "comic",
      pageTurnSound: "comic",
    });

    expect(getBookPresentationRule("horror_thriller")).toEqual({
      readerLayout: "spread",
      flipAnimation: "realistic",
      pageTurnSound: "cinematic",
    });
  });
});
