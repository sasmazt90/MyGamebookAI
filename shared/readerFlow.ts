export interface ReaderGraphPageLike {
  id: number;
  nextPageIdA?: number | null;
  nextPageIdB?: number | null;
}

export function getForwardAnchorIndex(
  currentPageIndex: number,
  step: number,
  pageCount: number,
): number {
  if (pageCount <= 0) return 0;
  const safeStep = Math.max(1, step);
  return Math.min(pageCount - 1, currentPageIndex + safeStep - 1);
}

export function resolveExplicitForwardPageId<T extends ReaderGraphPageLike>(
  pages: T[],
  currentPageIndex: number,
  step: number,
): number | null {
  const anchorIndex = getForwardAnchorIndex(currentPageIndex, step, pages.length);
  return pages[anchorIndex]?.nextPageIdA ?? null;
}

export function computeRoutePageNumbers<T extends ReaderGraphPageLike>(
  pages: T[],
): Map<number, number> {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const incomingPageIds = new Set<number>();

  for (const page of pages) {
    if (page.nextPageIdA) incomingPageIds.add(page.nextPageIdA);
    if (page.nextPageIdB) incomingPageIds.add(page.nextPageIdB);
  }

  const rootPageIds = pages
    .filter((page) => !incomingPageIds.has(page.id))
    .map((page) => page.id);
  const queue = (rootPageIds.length > 0 ? rootPageIds : pages.map((page) => page.id)).map(
    (pageId) => ({ pageId, depth: 1 }),
  );
  const routePageNumberById = new Map<number, number>();

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;

    const existingDepth = routePageNumberById.get(next.pageId);
    if (existingDepth != null && existingDepth <= next.depth) continue;

    const page = pageById.get(next.pageId);
    if (!page) continue;

    routePageNumberById.set(next.pageId, next.depth);

    if (page.nextPageIdA) {
      queue.push({ pageId: page.nextPageIdA, depth: next.depth + 1 });
    }
    if (page.nextPageIdB) {
      queue.push({ pageId: page.nextPageIdB, depth: next.depth + 1 });
    }
  }

  return routePageNumberById;
}
