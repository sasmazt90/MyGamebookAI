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
    });

    const pathLengths = enumerateReadablePathLengths(graph);
    expect(graph.length).toBeGreaterThan(10);
    expect(pathLengths.length).toBeGreaterThan(1);
    expect(pathLengths.every((value) => value === 10)).toBe(true);
    expect(validateStoryShape(graph, 10)).toEqual([]);
  });
});
