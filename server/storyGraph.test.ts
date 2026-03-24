import { describe, expect, it } from "vitest";
import { getBookGenerationRule } from "../shared/bookGenerationRules";
import { computeRoutePageNumbers } from "../shared/readerFlow";

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
    const rule = getBookGenerationRule("fairy_tale", "thin");
    const graph = buildFallbackStoryGraph({
      title: "Moon Garden",
      description: "A child follows magical lanterns through a moonlit forest.",
      readablePathLength: rule.readablePathLength,
      branchCount: rule.branchCount,
      targetBranchDepths: rule.targetBranchDepths,
      category: "fairy_tale",
    });

    const pathLengths = enumerateReadablePathLengths(graph);
    expect(graph.length).toBeGreaterThan(10);
    expect(pathLengths.length).toBeGreaterThan(1);
    expect(pathLengths.every((value) => value === 10)).toBe(true);
    expect(validateStoryShape(graph, 10)).toEqual([]);
  });

  it("localises fallback branch choices when a non-English language is requested", () => {
    const rule = getBookGenerationRule("fairy_tale", "thin");
    const graph = buildFallbackStoryGraph({
      title: "Aya Yolculuk",
      description: "Bir cocuk ve babasi Ay'a dogru yolculuga cikar.",
      readablePathLength: rule.readablePathLength,
      branchCount: 1,
      targetBranchDepths: rule.targetBranchDepths.slice(0, 1),
      category: "fairy_tale",
      language: "tr",
    });

    const branchPage = graph.find((page) => page.isBranchPage);
    expect(branchPage?.choiceA).toBe("Parlayan yıldız izini takip et");
    expect(branchPage?.choiceB).toBe("Pembe bulut yolundan ilerle");
  });

  it("uses distinct branch labels and route-aware sfx tags across deeper fallback branches", () => {
    const rule = getBookGenerationRule("fairy_tale", "thin");
    const graph = buildFallbackStoryGraph({
      title: "Aya Yolculuk",
      description: "Bir cocuk ve babasi Ay'a dogru yolculuga cikar.",
      readablePathLength: rule.readablePathLength,
      branchCount: rule.branchCount,
      targetBranchDepths: rule.targetBranchDepths,
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
    const rule = getBookGenerationRule("comic", "thin");
    const graph = buildFallbackStoryGraph({
      title: "Sehir Nobetinde",
      description: "Bir kahraman, gece sehrinde buyuyen tehdidi durdurmaya calisir.",
      readablePathLength: rule.readablePathLength,
      branchCount: rule.branchCount,
      targetBranchDepths: rule.targetBranchDepths,
      category: "comic",
      language: "tr",
    });

    const branchPages = graph.filter((page) => page.isBranchPage);
    expect(branchPages[0]?.choiceA).toBe("Doğrudan saldırıya geç");
    expect(branchPages[0]?.choiceB).toBe("Gölgelerden sız");
    expect(branchPages.some((page) => page.sfxTags.includes("impact") || page.sfxTags.includes("hero"))).toBe(true);
    expect(new Set(branchPages.map((page) => `${page.choiceA}|${page.choiceB}`)).size).toBeGreaterThan(1);
  });

  it("gives prose genres their own fallback branch language and sound cues", () => {
    const romanceRule = getBookGenerationRule("romance", "normal");
    const horrorRule = getBookGenerationRule("horror_thriller", "normal");
    const romanceGraph = buildFallbackStoryGraph({
      title: "Son Mektup",
      description: "Iki kisi yeniden karsilasir ve eski duygular geri gelir.",
      readablePathLength: romanceRule.readablePathLength,
      branchCount: romanceRule.branchCount,
      targetBranchDepths: romanceRule.targetBranchDepths,
      category: "romance",
      language: "tr",
    });
    const horrorGraph = buildFallbackStoryGraph({
      title: "Sessiz Ev",
      description: "Eski bir evin icindeki karanlik sir giderek buyur.",
      readablePathLength: horrorRule.readablePathLength,
      branchCount: horrorRule.branchCount,
      targetBranchDepths: horrorRule.targetBranchDepths,
      category: "horror_thriller",
      language: "tr",
    });

    const romanceBranch = romanceGraph.find((page) => page.isBranchPage);
    const horrorBranch = horrorGraph.find((page) => page.isBranchPage);

    expect(romanceBranch?.choiceA).toBe("Ay ışıklı bahçede buluş");
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

  it("keeps spread-category branch pages on even readable pages only", () => {
    const rule = getBookGenerationRule("comic", "normal");
    const graph = buildFallbackStoryGraph({
      title: "Skyline Run",
      description: "A hero races across a restless city.",
      readablePathLength: rule.readablePathLength,
      branchCount: rule.branchCount,
      targetBranchDepths: rule.targetBranchDepths,
      category: "comic",
    });
    const routePageNumbers = computeRoutePageNumbers(
      graph.map((page) => ({
        id: page.pageNumber,
        nextPageIdA: page.nextPageA,
        nextPageIdB: page.nextPageB,
      })),
    );
    const branchRoutePages = graph
      .filter((page) => page.isBranchPage)
      .map((page) => routePageNumbers.get(page.pageNumber));

    expect(branchRoutePages).toEqual(rule.targetBranchDepths);
    expect(branchRoutePages.every((pageNumber) => (pageNumber ?? 1) % 2 === 0)).toBe(true);
  });

  it("keeps fairy tale branch pages at the configured depths without an even-page constraint", () => {
    const rule = getBookGenerationRule("fairy_tale", "thin");
    const graph = buildFallbackStoryGraph({
      title: "Moon Garden",
      description: "A child follows magical lanterns through a moonlit forest.",
      readablePathLength: rule.readablePathLength,
      branchCount: rule.branchCount,
      targetBranchDepths: rule.targetBranchDepths,
      category: "fairy_tale",
    });
    const routePageNumbers = computeRoutePageNumbers(
      graph.map((page) => ({
        id: page.pageNumber,
        nextPageIdA: page.nextPageA,
        nextPageIdB: page.nextPageB,
      })),
    );

    expect(
      graph
        .filter((page) => page.isBranchPage)
        .map((page) => routePageNumbers.get(page.pageNumber)),
    ).toEqual(rule.targetBranchDepths);
  });

  it("assigns monotonically increasing route page numbers along every edge", () => {
    const rule = getBookGenerationRule("comic", "normal");
    const graph = buildFallbackStoryGraph({
      title: "Skyline Run",
      description: "A hero races across a restless city.",
      readablePathLength: rule.readablePathLength,
      branchCount: rule.branchCount,
      targetBranchDepths: rule.targetBranchDepths,
      category: "comic",
    });
    const routePageNumbers = computeRoutePageNumbers(
      graph.map((page) => ({
        id: page.pageNumber,
        nextPageIdA: page.nextPageA,
        nextPageIdB: page.nextPageB,
      })),
    );

    for (const page of graph) {
      const currentDepth = routePageNumbers.get(page.pageNumber);
      if (page.nextPageA) {
        expect(routePageNumbers.get(page.nextPageA)).toBe((currentDepth ?? 0) + 1);
      }
      if (page.nextPageB) {
        expect(routePageNumbers.get(page.nextPageB)).toBe((currentDepth ?? 0) + 1);
      }
    }
  });
});
