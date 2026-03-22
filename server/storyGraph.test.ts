import { describe, expect, it } from "vitest";

import {
  buildFallbackStoryGraph,
  computeStoryGenerationTargets,
  enumerateReadablePathLengths,
  validateStoryShape,
} from "./storyGraph";

describe("story graph planning", () => {
  it("separates readable path length from total graph size", () => {
    const targets = computeStoryGenerationTargets("fairy_tale", "thin");
    expect(targets.graphPageCount).toBeGreaterThan(targets.readablePathLength);
  });

  it("builds a fallback graph where every ending path matches the readable path length", () => {
    const graph = buildFallbackStoryGraph({
      title: "Moon Garden",
      description: "A child follows magical lanterns through a moonlit forest.",
      readablePathLength: 10,
      branchCount: 3,
      category: "fairy_tale",
    });

    const pathLengths = enumerateReadablePathLengths(graph);
    expect(graph.length).toBeGreaterThan(10);
    expect(pathLengths.length).toBeGreaterThan(1);
    expect(pathLengths.every((value) => value === 10)).toBe(true);
    expect(validateStoryShape(graph, 10)).toEqual([]);
  });

  it("localises fallback branch choices when a non-English language is requested", () => {
    const graph = buildFallbackStoryGraph({
      title: "Aya Yolculuk",
      description: "Bir cocuk ve babasi Ay'a dogru yolculuga cikar.",
      readablePathLength: 10,
      branchCount: 1,
      category: "fairy_tale",
      language: "tr",
    });

    const branchPage = graph.find((page) => page.isBranchPage);
    expect(branchPage?.choiceA).toBe("Cesur yolu sec");
    expect(branchPage?.choiceB).toBe("Dikkatli yolu sec");
  });

  it("detects cycles instead of recursing indefinitely", () => {
    const cyclicGraph = [
      {
        pageNumber: 1,
        branchPath: "root",
        isBranchPage: false,
        isEnding: false,
        content: "Loop start",
        sfxTags: ["wind"],
        choiceA: null,
        choiceB: null,
        nextPageA: 2,
        nextPageB: null,
      },
      {
        pageNumber: 2,
        branchPath: "root",
        isBranchPage: false,
        isEnding: false,
        content: "Loop middle",
        sfxTags: ["wind"],
        choiceA: null,
        choiceB: null,
        nextPageA: 1,
        nextPageB: null,
      },
    ];

    expect(enumerateReadablePathLengths(cyclicGraph)).toEqual([]);
    expect(validateStoryShape(cyclicGraph, 2)).toContain(
      "Story graph contains a cycle involving pages: 1, 2."
    );
  });
});
