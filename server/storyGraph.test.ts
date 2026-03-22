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
    expect(branchPage?.choiceA).toBe("Parlayan yildiz izini takip et");
    expect(branchPage?.choiceB).toBe("Pembe bulut yolundan ilerle");
  });

  it("uses distinct branch labels and route-aware sfx tags across deeper fallback branches", () => {
    const graph = buildFallbackStoryGraph({
      title: "Aya Yolculuk",
      description: "Bir cocuk ve babasi Ay'a dogru yolculuga cikar.",
      readablePathLength: 10,
      branchCount: 3,
      category: "fairy_tale",
      language: "tr",
    });

    const branchChoices = graph
      .filter((page) => page.isBranchPage)
      .map((page) => `${page.choiceA}|${page.choiceB}`);

    expect(new Set(branchChoices).size).toBeGreaterThan(1);
    expect(graph.every((page) => page.sfxTags.length > 0)).toBe(true);
    expect(graph.some((page) => page.sfxTags.includes("star") || page.sfxTags.includes("magic"))).toBe(true);
    expect(graph.some((page) => page.sfxTags.includes("door"))).toBe(true);
  });

  it("gives comic fallback branches genre-specific action choices instead of generic prose labels", () => {
    const graph = buildFallbackStoryGraph({
      title: "Sehir Nobetinde",
      description: "Bir kahraman, gece sehrinde buyuyen tehdidi durdurmaya calisir.",
      readablePathLength: 10,
      branchCount: 3,
      category: "comic",
      language: "tr",
    });

    const branchPages = graph.filter((page) => page.isBranchPage);
    expect(branchPages[0]?.choiceA).toBe("Dogrudan saldiriya gec");
    expect(branchPages[0]?.choiceB).toBe("Golgelerden siz");
    expect(branchPages.some((page) => page.sfxTags.includes("impact") || page.sfxTags.includes("hero"))).toBe(true);
    expect(new Set(branchPages.map((page) => `${page.choiceA}|${page.choiceB}`)).size).toBeGreaterThan(1);
  });

  it("gives prose genres their own fallback branch language and sound cues", () => {
    const romanceGraph = buildFallbackStoryGraph({
      title: "Son Mektup",
      description: "Iki kisi yeniden karsilasir ve eski duygular geri gelir.",
      readablePathLength: 10,
      branchCount: 3,
      category: "romance",
      language: "tr",
    });
    const horrorGraph = buildFallbackStoryGraph({
      title: "Sessiz Ev",
      description: "Eski bir evin icindeki karanlik sir giderek buyur.",
      readablePathLength: 10,
      branchCount: 3,
      category: "horror_thriller",
      language: "tr",
    });

    const romanceBranch = romanceGraph.find((page) => page.isBranchPage);
    const horrorBranch = horrorGraph.find((page) => page.isBranchPage);

    expect(romanceBranch?.choiceA).toBe("Ay isikli bahcede bulus");
    expect(horrorBranch?.choiceA).toBe("Bodrum merdivenlerinden in");
    expect(romanceGraph.some((page) => page.sfxTags.includes("soft") || page.sfxTags.includes("music"))).toBe(true);
    expect(horrorGraph.some((page) => page.sfxTags.includes("horror") || page.sfxTags.includes("heartbeat"))).toBe(true);
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
