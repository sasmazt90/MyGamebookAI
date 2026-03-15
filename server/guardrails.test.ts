/**
 * Guardrail unit tests for the Gamebook generation pipeline.
 *
 * GUARDRAIL 1: No-Merge Branching
 *   - Each page node must be referenced as a branch target by at most ONE source page.
 *   - If any pageId appears in nextPageA/nextPageB of more than one page, it is a merge violation.
 *
 * GUARDRAIL 2: Branch-Safe Rolling Context
 *   - The "last 3 pages" rolling context must only include pages from the same branch lineage.
 *   - Pages from sibling branches must never appear in the context.
 */

import { describe, it, expect } from "vitest";

// ─── Guardrail 1: No-Merge Branching Validator ───────────────────────────────

type PageStub = {
  pageNumber: number;
  branchPath: string;
  isBranchPage: boolean;
  nextPageA: number | null;
  nextPageB: number | null;
};

/**
 * Detects merge violations: any pageId referenced as a branch target by more
 * than one source page. Returns a list of violation descriptions.
 */
function detectMergeViolations(pages: PageStub[]): string[] {
  const targetRefCount = new Map<number, number[]>();
  for (const page of pages) {
    if (page.isBranchPage) {
      if (page.nextPageA) {
        const refs = targetRefCount.get(page.nextPageA) ?? [];
        refs.push(page.pageNumber);
        targetRefCount.set(page.nextPageA, refs);
      }
      if (page.nextPageB) {
        const refs = targetRefCount.get(page.nextPageB) ?? [];
        refs.push(page.pageNumber);
        targetRefCount.set(page.nextPageB, refs);
      }
    }
  }
  const violations: string[] = [];
  for (const [targetId, sourceIds] of Array.from(targetRefCount.entries())) {
    if (sourceIds.length > 1) {
      violations.push(
        `MERGE VIOLATION: Page ${targetId} is referenced by multiple pages: [${sourceIds.join(", ")}]`
      );
    }
  }
  return violations;
}

describe("GUARDRAIL 1 — No-Merge Branching", () => {
  it("passes a clean linear story with no branches", () => {
    const pages: PageStub[] = [
      { pageNumber: 1, branchPath: "root", isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 2, branchPath: "root", isBranchPage: false, nextPageA: null, nextPageB: null },
    ];
    expect(detectMergeViolations(pages)).toHaveLength(0);
  });

  it("passes a clean branching tree where no page is reused", () => {
    // Page 1 (root) → branch → page 2 (A) and page 3 (B)
    // Page 2 (A) → page 4 (A ending)
    // Page 3 (B) → page 5 (B ending)
    const pages: PageStub[] = [
      { pageNumber: 1, branchPath: "root", isBranchPage: true,  nextPageA: 2, nextPageB: 3 },
      { pageNumber: 2, branchPath: "A",    isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 3, branchPath: "B",    isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 4, branchPath: "A",    isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 5, branchPath: "B",    isBranchPage: false, nextPageA: null, nextPageB: null },
    ];
    expect(detectMergeViolations(pages)).toHaveLength(0);
  });

  it("flags a merge violation when two branch pages point to the same target page", () => {
    // Page 2 (A) and Page 3 (B) both point to page 4 — this is a merge!
    const pages: PageStub[] = [
      { pageNumber: 1, branchPath: "root", isBranchPage: true,  nextPageA: 2, nextPageB: 3 },
      { pageNumber: 2, branchPath: "A",    isBranchPage: true,  nextPageA: 4, nextPageB: 5 }, // A → 4
      { pageNumber: 3, branchPath: "B",    isBranchPage: true,  nextPageA: 4, nextPageB: 6 }, // B → 4 (MERGE!)
      { pageNumber: 4, branchPath: "A",    isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 5, branchPath: "A",    isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 6, branchPath: "B",    isBranchPage: false, nextPageA: null, nextPageB: null },
    ];
    const violations = detectMergeViolations(pages);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("Page 4");
    expect(violations[0]).toContain("MERGE VIOLATION");
  });

  it("flags multiple merge violations when several pages are reused", () => {
    // Pages 4 and 5 are both shared across branches — two merge violations
    const pages: PageStub[] = [
      { pageNumber: 1, branchPath: "root", isBranchPage: true,  nextPageA: 2, nextPageB: 3 },
      { pageNumber: 2, branchPath: "A",    isBranchPage: true,  nextPageA: 4, nextPageB: 5 },
      { pageNumber: 3, branchPath: "B",    isBranchPage: true,  nextPageA: 4, nextPageB: 5 }, // both shared
      { pageNumber: 4, branchPath: "A",    isBranchPage: false, nextPageA: null, nextPageB: null },
      { pageNumber: 5, branchPath: "A",    isBranchPage: false, nextPageA: null, nextPageB: null },
    ];
    const violations = detectMergeViolations(pages);
    expect(violations).toHaveLength(2);
  });
});

// ─── Guardrail 2: Branch-Safe Rolling Context Selector ───────────────────────

/**
 * Builds a parent map from the page list, then walks up the lineage to return
 * the last `limit` ancestor page numbers for a given page.
 * This is the exact algorithm used in the expansion pass.
 */
function getBranchAncestors(pages: PageStub[], pageNum: number, limit: number): number[] {
  const parentMap = new Map<number, number>();
  for (const p of pages) {
    if (p.nextPageA) parentMap.set(p.nextPageA, p.pageNumber);
    if (p.nextPageB) parentMap.set(p.nextPageB, p.pageNumber);
  }
  const ancestors: number[] = [];
  let current = parentMap.get(pageNum);
  while (current !== undefined && ancestors.length < limit) {
    ancestors.unshift(current);
    current = parentMap.get(current);
  }
  return ancestors.slice(-limit);
}

describe("GUARDRAIL 2 — Branch-Safe Rolling Context", () => {
  // Story tree:
  //   1 (root) → branch → 2 (A path), 3 (B path)
  //   2 (A) → 4 (A-A), 5 (A-B)   [second branch on A path]
  //   3 (B) → 6 (B ending)
  //   4 (A-A) → 7 (A-A ending)
  //   5 (A-B) → 8 (A-B ending)
  const pages: PageStub[] = [
    { pageNumber: 1, branchPath: "root", isBranchPage: true,  nextPageA: 2,    nextPageB: 3    },
    { pageNumber: 2, branchPath: "A",    isBranchPage: true,  nextPageA: 4,    nextPageB: 5    },
    { pageNumber: 3, branchPath: "B",    isBranchPage: false, nextPageA: 6,    nextPageB: null },
    { pageNumber: 4, branchPath: "A-A",  isBranchPage: false, nextPageA: 7,    nextPageB: null },
    { pageNumber: 5, branchPath: "A-B",  isBranchPage: false, nextPageA: 8,    nextPageB: null },
    { pageNumber: 6, branchPath: "B",    isBranchPage: false, nextPageA: null, nextPageB: null },
    { pageNumber: 7, branchPath: "A-A",  isBranchPage: false, nextPageA: null, nextPageB: null },
    { pageNumber: 8, branchPath: "A-B",  isBranchPage: false, nextPageA: null, nextPageB: null },
  ];

  it("returns empty ancestors for the root page (page 1 has no parent)", () => {
    const ancestors = getBranchAncestors(pages, 1, 3);
    expect(ancestors).toHaveLength(0);
  });

  it("returns only the root page as ancestor for a first-level branch page", () => {
    // Page 2 (A path) — parent is page 1 (root)
    const ancestors = getBranchAncestors(pages, 2, 3);
    expect(ancestors).toEqual([1]);
  });

  it("returns only pages from the A branch lineage for page 4 (A-A path)", () => {
    // Page 4 (A-A path) — lineage is: 1 (root) → 2 (A) → 4
    // Ancestors should be [1, 2], NOT [3] (B branch)
    const ancestors = getBranchAncestors(pages, 4, 3);
    expect(ancestors).toEqual([1, 2]);
    expect(ancestors).not.toContain(3); // page 3 is on B branch — must NOT appear
    expect(ancestors).not.toContain(6); // page 6 is on B branch — must NOT appear
  });

  it("returns only pages from the B branch lineage for page 6 (B path)", () => {
    // Page 6 (B path) — lineage is: 1 (root) → 3 (B) → 6
    // Ancestors should be [1, 3], NOT [2, 4, 5] (A branch pages)
    const ancestors = getBranchAncestors(pages, 6, 3);
    expect(ancestors).toEqual([1, 3]);
    expect(ancestors).not.toContain(2); // page 2 is on A branch — must NOT appear
    expect(ancestors).not.toContain(4); // page 4 is on A-A branch — must NOT appear
    expect(ancestors).not.toContain(5); // page 5 is on A-B branch — must NOT appear
  });

  it("respects the limit parameter and returns at most N ancestors", () => {
    // Page 7 (A-A ending) — lineage is: 1 → 2 → 4 → 7 (depth 3)
    // With limit=2, should return only [2, 4] (the 2 closest ancestors)
    const ancestors = getBranchAncestors(pages, 7, 2);
    expect(ancestors).toHaveLength(2);
    expect(ancestors).toEqual([2, 4]);
    expect(ancestors).not.toContain(1); // trimmed by limit
  });

  it("sibling branch pages never share ancestors beyond the common root", () => {
    // Page 4 (A-A) and page 5 (A-B) share ancestors [1, 2] but diverge after page 2
    const ancestorsAA = getBranchAncestors(pages, 4, 3);
    const ancestorsAB = getBranchAncestors(pages, 5, 3);
    // Both share [1, 2] — that is correct (common trunk before the branch)
    expect(ancestorsAA).toEqual([1, 2]);
    expect(ancestorsAB).toEqual([1, 2]);
    // Neither should contain the other's exclusive pages
    expect(ancestorsAA).not.toContain(5);
    expect(ancestorsAB).not.toContain(4);
  });
});
