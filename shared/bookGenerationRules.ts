export type SupportedBookCategory =
  | "fairy_tale"
  | "comic"
  | "horror_thriller"
  | "romance"
  | "crime_mystery"
  | "fantasy_scifi";

export type SupportedBookLength = "thin" | "normal" | "thick";

export type ReaderLayoutMode = "storybook-single" | "comic-panels" | "spread";
export type FlipAnimationMode = "storybook" | "comic" | "realistic";
export type PageTurnSoundMode = "storybook" | "comic" | "cinematic";

export interface BookGenerationRule {
  readablePathLength: number;
  branchCount: number;
  targetBranchDepths: number[];
  branchImageCount: number;
  graphPageCount: number;
  pageCountLabel: string;
  imageCallCount: number;
  renderedVisualCount: number;
}

export interface BookPresentationRule {
  readerLayout: ReaderLayoutMode;
  flipAnimation: FlipAnimationMode;
  pageTurnSound: PageTurnSoundMode;
}

export interface BookCategoryRule {
  allowedLengths: SupportedBookLength[];
  presentation: BookPresentationRule;
  lengths: Partial<Record<SupportedBookLength, BookGenerationRule>>;
}

type RuleSeed = {
  readablePathLength: number;
  targetBranchDepths: number[];
  branchImageCount: number;
  pageCountLabel: string;
  imageCallCount: number;
  renderedVisualCount: number;
};

function computeGraphPageCount(
  readablePathLength: number,
  targetBranchDepths: number[],
): number {
  return targetBranchDepths.reduce(
    (total, depth) => total + Math.max(0, readablePathLength - depth),
    readablePathLength,
  );
}

function createGenerationRule(seed: RuleSeed): BookGenerationRule {
  return {
    readablePathLength: seed.readablePathLength,
    branchCount: seed.targetBranchDepths.length,
    targetBranchDepths: seed.targetBranchDepths,
    branchImageCount: seed.branchImageCount,
    graphPageCount: computeGraphPageCount(
      seed.readablePathLength,
      seed.targetBranchDepths,
    ),
    pageCountLabel: seed.pageCountLabel,
    imageCallCount: seed.imageCallCount,
    renderedVisualCount: seed.renderedVisualCount,
  };
}

export const BOOK_CATEGORY_RULES: Record<SupportedBookCategory, BookCategoryRule> = {
  fairy_tale: {
    allowedLengths: ["thin"],
    presentation: {
      readerLayout: "storybook-single",
      flipAnimation: "storybook",
      pageTurnSound: "storybook",
    },
    lengths: {
      thin: createGenerationRule({
        readablePathLength: 10,
        targetBranchDepths: [3, 6, 9],
        branchImageCount: 0,
        pageCountLabel: "10 pages",
        imageCallCount: 11,
        renderedVisualCount: 11,
      }),
    },
  },
  comic: {
    allowedLengths: ["thin", "normal"],
    presentation: {
      readerLayout: "comic-panels",
      flipAnimation: "comic",
      pageTurnSound: "comic",
    },
    lengths: {
      thin: createGenerationRule({
        readablePathLength: 10,
        targetBranchDepths: [4, 8],
        branchImageCount: 0,
        pageCountLabel: "10 pages",
        imageCallCount: 11,
        renderedVisualCount: 31,
      }),
      normal: createGenerationRule({
        readablePathLength: 18,
        targetBranchDepths: [4, 8, 12, 16],
        branchImageCount: 0,
        pageCountLabel: "18 pages",
        imageCallCount: 19,
        renderedVisualCount: 55,
      }),
    },
  },
  horror_thriller: {
    allowedLengths: ["normal", "thick"],
    presentation: {
      readerLayout: "spread",
      flipAnimation: "realistic",
      pageTurnSound: "cinematic",
    },
    lengths: {
      normal: createGenerationRule({
        readablePathLength: 80,
        targetBranchDepths: [8, 24, 40, 56, 72],
        branchImageCount: 5,
        pageCountLabel: "80 pages",
        imageCallCount: 6,
        renderedVisualCount: 6,
      }),
      thick: createGenerationRule({
        readablePathLength: 120,
        targetBranchDepths: [8, 20, 32, 44, 56, 68, 80, 92, 104, 116],
        branchImageCount: 10,
        pageCountLabel: "120 pages",
        imageCallCount: 11,
        renderedVisualCount: 11,
      }),
    },
  },
  romance: {
    allowedLengths: ["normal", "thick"],
    presentation: {
      readerLayout: "spread",
      flipAnimation: "realistic",
      pageTurnSound: "cinematic",
    },
    lengths: {
      normal: createGenerationRule({
        readablePathLength: 80,
        targetBranchDepths: [8, 24, 40, 56, 72],
        branchImageCount: 5,
        pageCountLabel: "80 pages",
        imageCallCount: 6,
        renderedVisualCount: 6,
      }),
      thick: createGenerationRule({
        readablePathLength: 120,
        targetBranchDepths: [8, 20, 32, 44, 56, 68, 80, 92, 104, 116],
        branchImageCount: 10,
        pageCountLabel: "120 pages",
        imageCallCount: 11,
        renderedVisualCount: 11,
      }),
    },
  },
  crime_mystery: {
    allowedLengths: ["normal", "thick"],
    presentation: {
      readerLayout: "spread",
      flipAnimation: "realistic",
      pageTurnSound: "cinematic",
    },
    lengths: {
      normal: createGenerationRule({
        readablePathLength: 80,
        targetBranchDepths: [8, 24, 40, 56, 72],
        branchImageCount: 5,
        pageCountLabel: "80 pages",
        imageCallCount: 6,
        renderedVisualCount: 6,
      }),
      thick: createGenerationRule({
        readablePathLength: 120,
        targetBranchDepths: [8, 20, 32, 44, 56, 68, 80, 92, 104, 116],
        branchImageCount: 10,
        pageCountLabel: "120 pages",
        imageCallCount: 11,
        renderedVisualCount: 11,
      }),
    },
  },
  fantasy_scifi: {
    allowedLengths: ["normal", "thick"],
    presentation: {
      readerLayout: "spread",
      flipAnimation: "realistic",
      pageTurnSound: "cinematic",
    },
    lengths: {
      normal: createGenerationRule({
        readablePathLength: 80,
        targetBranchDepths: [8, 24, 40, 56, 72],
        branchImageCount: 5,
        pageCountLabel: "80 pages",
        imageCallCount: 6,
        renderedVisualCount: 6,
      }),
      thick: createGenerationRule({
        readablePathLength: 120,
        targetBranchDepths: [8, 20, 32, 44, 56, 68, 80, 92, 104, 116],
        branchImageCount: 10,
        pageCountLabel: "120 pages",
        imageCallCount: 11,
        renderedVisualCount: 11,
      }),
    },
  },
};

const DEFAULT_CATEGORY: SupportedBookCategory = "fantasy_scifi";
const DEFAULT_LENGTH_BY_CATEGORY: Record<SupportedBookCategory, SupportedBookLength> = {
  fairy_tale: "thin",
  comic: "thin",
  horror_thriller: "normal",
  romance: "normal",
  crime_mystery: "normal",
  fantasy_scifi: "normal",
};

export function getAllowedLengthsForCategory(category: string): SupportedBookLength[] {
  return BOOK_CATEGORY_RULES[(category as SupportedBookCategory)]?.allowedLengths ?? ["thin", "normal", "thick"];
}

export function getDefaultLengthForCategory(category: string): SupportedBookLength {
  return DEFAULT_LENGTH_BY_CATEGORY[(category as SupportedBookCategory)] ?? DEFAULT_LENGTH_BY_CATEGORY[DEFAULT_CATEGORY];
}

export function getBookGenerationRule(category: string, length: string): BookGenerationRule {
  const categoryRule = BOOK_CATEGORY_RULES[(category as SupportedBookCategory)] ?? BOOK_CATEGORY_RULES[DEFAULT_CATEGORY];
  const fallbackLength = getDefaultLengthForCategory(category);
  return (
    categoryRule.lengths[length as SupportedBookLength] ??
    categoryRule.lengths[fallbackLength] ??
    BOOK_CATEGORY_RULES[DEFAULT_CATEGORY].lengths.normal!
  );
}

export function getBookPresentationRule(category: string): BookPresentationRule {
  return (
    BOOK_CATEGORY_RULES[(category as SupportedBookCategory)]?.presentation ??
    BOOK_CATEGORY_RULES[DEFAULT_CATEGORY].presentation
  );
}

export function getPageCountLabel(category: string, length: string): string {
  return getBookGenerationRule(category, length).pageCountLabel;
}
