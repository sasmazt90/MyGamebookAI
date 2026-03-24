import { describe, expect, it } from "vitest";
import {
  computeRoutePageNumbers,
  getForwardAnchorIndex,
  resolveExplicitForwardPageId,
} from "../shared/readerFlow";

describe("reader flow helpers", () => {
  it("uses the right-hand page as the forward anchor in spread mode", () => {
    const pages = [
      { id: 1, nextPageIdA: 2, nextPageIdB: null },
      { id: 2, nextPageIdA: 3, nextPageIdB: null },
      { id: 3, nextPageIdA: 4, nextPageIdB: null },
      { id: 4, nextPageIdA: 5, nextPageIdB: 7 },
    ];

    expect(getForwardAnchorIndex(0, 2, pages.length)).toBe(1);
    expect(resolveExplicitForwardPageId(pages, 0, 2)).toBe(3);
  });

  it("keeps route page numbering monotonic across a branched spread graph", () => {
    const pages = [
      { id: 1, nextPageIdA: 2, nextPageIdB: null },
      { id: 2, nextPageIdA: 3, nextPageIdB: null },
      { id: 3, nextPageIdA: 4, nextPageIdB: null },
      { id: 4, nextPageIdA: 5, nextPageIdB: 7 },
      { id: 5, nextPageIdA: 6, nextPageIdB: null },
      { id: 6, nextPageIdA: null, nextPageIdB: null },
      { id: 7, nextPageIdA: 8, nextPageIdB: null },
      { id: 8, nextPageIdA: null, nextPageIdB: null },
    ];
    const routeNumbers = computeRoutePageNumbers(pages);

    expect(routeNumbers.get(4)).toBe(4);
    expect(routeNumbers.get(5)).toBe(5);
    expect(routeNumbers.get(7)).toBe(5);
    expect(routeNumbers.get(8)).toBe(6);
  });
});
