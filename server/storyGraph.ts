import { getBookGenerationRule } from "../shared/bookGenerationRules";

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

type FallbackChoiceLabels = {
  choiceA: string;
  choiceB: string;
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
  const rule = getBookGenerationRule(category, length);
  return {
    readablePathLength: rule.readablePathLength,
    branchCount: rule.branchCount,
    branchImageCount: rule.branchImageCount,
    graphPageCount: rule.graphPageCount,
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
  const visit = (pageNumber: number, depth: number, activePath: Set<number>) => {
    if (activePath.has(pageNumber)) return;
    const page = byPage.get(pageNumber);
    if (!page) return;

    activePath.add(pageNumber);
    const nextA = page.nextPageA;
    const nextB = page.isBranchPage ? page.nextPageB : null;
    const hasChildren = !!nextA || !!nextB;
    if (!hasChildren) {
      lengths.push(depth);
      activePath.delete(pageNumber);
      return;
    }

    if (nextA) visit(nextA, depth + 1, activePath);
    if (nextB) visit(nextB, depth + 1, activePath);
    activePath.delete(pageNumber);
  };

  for (const root of roots) {
    visit(root, 1, new Set<number>());
  }

  return lengths;
}

function detectCyclePages(pages: StoryPage[]): number[] {
  const byPage = new Map<number, StoryPage>(pages.map((page) => [page.pageNumber, page]));
  const state = new Map<number, "visiting" | "visited">();
  const stack: number[] = [];
  const cycleNodes = new Set<number>();

  const visit = (pageNumber: number) => {
    const currentState = state.get(pageNumber);
    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(pageNumber);
      for (const node of stack.slice(cycleStart >= 0 ? cycleStart : 0)) {
        cycleNodes.add(node);
      }
      cycleNodes.add(pageNumber);
      return;
    }
    if (currentState === "visited") return;

    state.set(pageNumber, "visiting");
    stack.push(pageNumber);

    const page = byPage.get(pageNumber);
    const nextPages = page
      ? [page.nextPageA, page.isBranchPage ? page.nextPageB : null].filter(
          (value): value is number => value !== null
        )
      : [];

    for (const nextPageNumber of nextPages) {
      visit(nextPageNumber);
    }

    stack.pop();
    state.set(pageNumber, "visited");
  };

  for (const page of pages) {
    visit(page.pageNumber);
  }

  return Array.from(cycleNodes).sort((left, right) => left - right);
}

export function validateStoryShape(pages: StoryPage[], readablePathLength: number): string[] {
  const errors: string[] = [];
  if (pages.length <= readablePathLength) {
    errors.push("Graph must contain more pages than a single readable path.");
  }

  const cyclePages = detectCyclePages(pages);
  if (cyclePages.length > 0) {
    errors.push(`Story graph contains a cycle involving pages: ${cyclePages.join(", ")}.`);
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

function normaliseLanguageCode(language?: string): string {
  return (language ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
}

function getFallbackChoiceLabels(language?: string): FallbackChoiceLabels {
  switch (normaliseLanguageCode(language)) {
    case "tr":
      return {
        choiceA: "Cesur yolu sec",
        choiceB: "Dikkatli yolu sec",
      };
    case "de":
      return {
        choiceA: "Wahle den mutigen Weg",
        choiceB: "Wahle den vorsichtigen Weg",
      };
    case "fr":
      return {
        choiceA: "Choisis la voie audacieuse",
        choiceB: "Choisis la voie prudente",
      };
    case "es":
      return {
        choiceA: "Elige el camino valiente",
        choiceB: "Elige el camino prudente",
      };
    default:
      return {
        choiceA: "Take the bold path",
        choiceB: "Take the cautious path",
      };
  }
}

function branchDepths(readablePathLength: number, branchCount: number, category?: string): number[] {
  if (branchCount <= 0) return [];
  const branchStart = category === "fairy_tale" ? 3 : 4;
  const start = Math.min(Math.max(2, branchStart), Math.max(2, readablePathLength - 3));
  const end = Math.max(start, readablePathLength - 2);
  if (branchCount === 1) return [Math.floor((start + end) / 2)];

  const spacing = Math.max(1, Math.floor((end - start) / (branchCount - 1)));

  return Array.from({ length: branchCount }, (_, index) => {
    return Math.max(start, Math.min(readablePathLength - 2, start + index * spacing));
  });
}

function buildFallbackOutline(input: {
  title: string;
  description: string;
  branchPath: string;
  depth: number;
  readablePathLength: number;
  isBranchPage: boolean;
  isEnding: boolean;
}): string {
  const premise = input.description.trim() || `the adventure in "${input.title}"`;
  const branchLabel = input.branchPath === "root" ? "main path" : `branch ${input.branchPath}`;

  if (input.depth === 1) {
    return `Open "${input.title}" by introducing the main characters, the setting, and the central problem drawn from ${premise}.`;
  }

  if (input.isBranchPage) {
    return `Create a concrete decision on the ${branchLabel}. The next scene must split into two visibly different outcomes tied directly to ${premise}.`;
  }

  if (input.isEnding) {
    return `Deliver a satisfying ending on the ${branchLabel}. Resolve the central problem from ${premise} with a distinct emotional payoff for this route.`;
  }

  if (input.branchPath === "root") {
    return `Advance the main route on page-depth ${input.depth}. Build directly on the previous action and keep the narrative specific to ${premise}.`;
  }

  return `Continue the ${branchLabel} consequence on page-depth ${input.depth}. Show a concrete new development that could not happen on the unchosen route, while staying faithful to ${premise}.`;
}

export function buildFallbackStoryGraph(input: {
  title: string;
  description: string;
  readablePathLength: number;
  branchCount: number;
  category?: string;
  language?: string;
}): StoryPage[] {
  let nextId = 1;
  const nodes = new Map<number, PlannedNode>();
  const rootPathNodes: number[] = [];
  const fallbackChoices = getFallbackChoiceLabels(input.language);

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
      content: buildFallbackOutline({
        title: input.title,
        description: input.description,
        branchPath: "root",
        depth,
        readablePathLength: input.readablePathLength,
        isBranchPage: false,
        isEnding: depth === input.readablePathLength,
      }),
      choiceA: null,
      choiceB: null,
    });
  }

  const activePaths: ActivePath[] = [{ label: "root", nodes: rootPathNodes }];
  const depths = branchDepths(input.readablePathLength, input.branchCount, input.category);

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
    branchNode.choiceA = fallbackChoices.choiceA;
    branchNode.choiceB = fallbackChoices.choiceB;

    for (let offset = 0; offset < existingSuffix.length; offset += 1) {
      const existingId = existingSuffix[offset];
      const existingNode = nodes.get(existingId);
        if (existingNode) {
          existingNode.branchPath = aLabel;
          existingNode.content = buildFallbackOutline({
            title: input.title,
            description: input.description,
            branchPath: aLabel,
            depth: existingNode.depth,
            readablePathLength: input.readablePathLength,
            isBranchPage: existingNode.isBranchPage,
            isEnding: existingNode.isEnding,
          });
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
          content: buildFallbackOutline({
            title: input.title,
            description: input.description,
            branchPath: bLabel,
            depth: clonedDepth,
            readablePathLength: input.readablePathLength,
            isBranchPage: false,
            isEnding: clonedDepth === input.readablePathLength,
          }),
          choiceA: null,
          choiceB: null,
        });
      }

    branchNode.nextA = existingSuffix[0] ?? null;
    branchNode.nextB = branchBNodes[0] ?? null;
    branchNode.content = buildFallbackOutline({
      title: input.title,
      description: input.description,
      branchPath: path.label,
      depth: targetDepth,
      readablePathLength: input.readablePathLength,
      isBranchPage: true,
      isEnding: false,
    });

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
