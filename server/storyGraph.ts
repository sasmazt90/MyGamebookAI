export type StoryPage = {
  pageNumber: number;
  branchPath: string;
  isBranchPage: boolean;
  isEnding?: boolean;
  content: string;
  sfxTags: string[];
  choiceA: string | null;
  choiceB: string | null;
  nextPageA: number | null;
  nextPageB: number | null;
};

export type StoryGenerationTargets = {
  readablePathLength: number;
  branchCount: number;
  branchImageCount: number;
  graphPageCount: number;
};

type PlannedNode = {
  id: number;
  branchPath: string;
  depth: number;
  isBranchPage: boolean;
  isEnding: boolean;
  nextA: number | null;
  nextB: number | null;
  content: string;
  choiceA: string | null;
  choiceB: string | null;
};

type ActivePath = {
  label: string;
  nodes: number[];
};

export function computeStoryGenerationTargets(category: string, length: string): StoryGenerationTargets {
  if (category === "fairy_tale") {
    return {
      readablePathLength: 10,
      branchCount: 3,
      branchImageCount: 0,
      graphPageCount: 16,
    };
  }

  if (category === "comic") {
    return {
      readablePathLength: length === "thin" ? 10 : 18,
      branchCount: length === "thin" ? 3 : 5,
      branchImageCount: 0,
      graphPageCount: length === "thin" ? 16 : 28,
    };
  }

  return {
    readablePathLength: length === "normal" ? 80 : 120,
    branchCount: length === "normal" ? 8 : 12,
    branchImageCount: length === "normal" ? 8 : 12,
    graphPageCount: length === "normal" ? 104 : 156,
  };
}

export function enumerateReadablePathLengths(pages: StoryPage[]): number[] {
  const byPage = new Map<number, StoryPage>(pages.map((page) => [page.pageNumber, page]));
  const incoming = new Set<number>();
  for (const page of pages) {
    if (page.nextPageA) incoming.add(page.nextPageA);
    if (page.nextPageB) incoming.add(page.nextPageB);
  }

  const roots = pages
    .filter((page) => !incoming.has(page.pageNumber))
    .map((page) => page.pageNumber);

  const lengths: number[] = [];
  const visit = (pageNumber: number, depth: number) => {
    const page = byPage.get(pageNumber);
    if (!page) return;

    const nextA = page.nextPageA;
    const nextB = page.isBranchPage ? page.nextPageB : null;
    const hasChildren = !!nextA || !!nextB;
    if (!hasChildren) {
      lengths.push(depth);
      return;
    }

    if (nextA) visit(nextA, depth + 1);
    if (nextB) visit(nextB, depth + 1);
  };

  for (const root of roots) {
    visit(root, 1);
  }

  return lengths;
}

export function validateStoryShape(pages: StoryPage[], readablePathLength: number): string[] {
  const errors: string[] = [];
  if (pages.length <= readablePathLength) {
    errors.push("Graph must contain more pages than a single readable path.");
  }

  const pathLengths = enumerateReadablePathLengths(pages);
  if (pathLengths.length === 0) {
    errors.push("Story graph has no complete readable path.");
  }
  for (const pathLength of pathLengths) {
    if (pathLength !== readablePathLength) {
      errors.push(
        `Readable path length mismatch: expected ${readablePathLength}, got ${pathLength}.`
      );
    }
  }

  for (const page of pages) {
    if (page.isBranchPage) {
      if (!page.choiceA || !page.choiceB) {
        errors.push(`Page ${page.pageNumber} is a branch page without two explicit choices.`);
      }
      if (!page.nextPageA || !page.nextPageB || page.nextPageA === page.nextPageB) {
        errors.push(`Page ${page.pageNumber} must branch to two different target pages.`);
      }
    } else if (!page.isEnding && !page.nextPageA) {
      errors.push(`Page ${page.pageNumber} is missing its linear continuation target.`);
    }
  }

  return errors;
}

function branchDepths(readablePathLength: number, branchCount: number): number[] {
  if (branchCount <= 0) return [];
  const start = Math.max(2, Math.floor(readablePathLength * 0.55));
  const end = Math.max(start, readablePathLength - 2);
  if (branchCount === 1) return [Math.floor((start + end) / 2)];

  return Array.from({ length: branchCount }, (_, index) => {
    const ratio = index / (branchCount - 1);
    return Math.max(2, Math.min(readablePathLength - 2, Math.round(start + (end - start) * ratio)));
  });
}

export function buildFallbackStoryGraph(input: {
  title: string;
  description: string;
  readablePathLength: number;
  branchCount: number;
}): StoryPage[] {
  let nextId = 1;
  const nodes = new Map<number, PlannedNode>();
  const rootPathNodes: number[] = [];

  for (let depth = 1; depth <= input.readablePathLength; depth += 1) {
    const id = nextId++;
    rootPathNodes.push(id);
    nodes.set(id, {
      id,
      branchPath: "root",
      depth,
      isBranchPage: false,
      isEnding: depth === input.readablePathLength,
      nextA: depth < input.readablePathLength ? id + 1 : null,
      nextB: null,
      content:
        depth === 1
          ? `Opening setup for "${input.title}". Introduce the cast, world, and core problem drawn from: ${input.description}`
          : `Continue the root storyline on page-depth ${depth}. Keep the story specific to ${input.description}`,
      choiceA: null,
      choiceB: null,
    });
  }

  const activePaths: ActivePath[] = [{ label: "root", nodes: rootPathNodes }];
  const depths = branchDepths(input.readablePathLength, input.branchCount);

  for (let branchIndex = 0; branchIndex < input.branchCount; branchIndex += 1) {
    const targetDepth = depths[branchIndex];
    const candidatePaths = activePaths.filter((path) => {
      const nodeId = path.nodes[targetDepth - 1];
      const node = nodeId ? nodes.get(nodeId) : null;
      return !!node && !node.isBranchPage && !node.isEnding;
    });
    if (candidatePaths.length === 0) break;

    candidatePaths.sort((left, right) => {
      const leftBranches = left.label === "root" ? 0 : left.label.split("-").length;
      const rightBranches = right.label === "root" ? 0 : right.label.split("-").length;
      if (leftBranches !== rightBranches) return leftBranches - rightBranches;
      return left.label.localeCompare(right.label);
    });

    const path = candidatePaths[branchIndex % candidatePaths.length];
    const branchNodeId = path.nodes[targetDepth - 1];
    const branchNode = nodes.get(branchNodeId);
    if (!branchNode) continue;

    const branchBase = path.label === "root" ? "" : `${path.label}-`;
    const aLabel = `${branchBase}A`.replace(/^-/, "");
    const bLabel = `${branchBase}B`.replace(/^-/, "");
    const existingSuffix = path.nodes.slice(targetDepth);
    const branchBNodes: number[] = [];

    branchNode.isBranchPage = true;
    branchNode.choiceA = "Take the bold option";
    branchNode.choiceB = "Take the cautious option";

    for (let offset = 0; offset < existingSuffix.length; offset += 1) {
      const existingId = existingSuffix[offset];
      const existingNode = nodes.get(existingId);
      if (existingNode) {
        existingNode.branchPath = aLabel;
        existingNode.content = `Branch ${aLabel} at depth ${existingNode.depth}: continue the bold consequence of the earlier choice. ${input.description}`;
      }

      const clonedId = nextId++;
      const clonedDepth = targetDepth + offset + 1;
      branchBNodes.push(clonedId);
      nodes.set(clonedId, {
        id: clonedId,
        branchPath: bLabel,
        depth: clonedDepth,
        isBranchPage: false,
        isEnding: clonedDepth === input.readablePathLength,
        nextA: null,
        nextB: null,
        content: `Branch ${bLabel} at depth ${clonedDepth}: continue the cautious consequence of the earlier choice. ${input.description}`,
        choiceA: null,
        choiceB: null,
      });
    }

    branchNode.nextA = existingSuffix[0] ?? null;
    branchNode.nextB = branchBNodes[0] ?? null;
    branchNode.content = `Decision point at depth ${targetDepth}. Force a meaningful split in outcome and atmosphere for "${input.title}".`;

    for (let index = 0; index < existingSuffix.length; index += 1) {
      const currentId = branchBNodes[index];
      const nextNodeId = branchBNodes[index + 1] ?? null;
      const node = nodes.get(currentId);
      if (!node) continue;
      node.nextA = node.isEnding ? null : nextNodeId;
    }

    path.nodes = path.nodes.slice(0, targetDepth).concat(existingSuffix);
    path.label = aLabel;
    activePaths.push({
      label: bLabel,
      nodes: path.nodes.slice(0, targetDepth).concat(branchBNodes),
    });
  }

  const planned = Array.from(nodes.values()).sort((left, right) => left.id - right.id);
  const renumber = new Map<number, number>();
  planned.forEach((node, index) => {
    renumber.set(node.id, index + 1);
  });

  return planned.map((node) => ({
    pageNumber: renumber.get(node.id) ?? node.id,
    branchPath: node.branchPath,
    isBranchPage: node.isBranchPage,
    isEnding: node.isEnding,
    content: node.content,
    sfxTags: ["story_ambience"],
    choiceA: node.choiceA,
    choiceB: node.choiceB,
    nextPageA: node.nextA ? (renumber.get(node.nextA) ?? null) : null,
    nextPageB: node.nextB ? (renumber.get(node.nextB) ?? null) : null,
  }));
}
