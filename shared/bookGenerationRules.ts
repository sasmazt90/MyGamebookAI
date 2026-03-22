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

export const BOOK_CATEGORY_RULES: Record<SupportedBookCategory, BookCategoryRule> = {
  fairy_tale: {
    allowedLengths: ["thin"],
    presentation: {
      readerLayout: "storybook-single",
      flipAnimation: "storybook",
      pageTurnSound: "storybook",
    },
    lengths: {
      thin: {
        readablePathLength: 10,
        branchCount: 3,
        branchImageCount: 0,
        graphPageCount: 16,
        pageCountLabel: "10 pages",
        imageCallCount: 11,
        renderedVisualCount: 11,
      },
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
      thin: {
        readablePathLength: 10,
        branchCount: 3,
        branchImageCount: 0,
        graphPageCount: 16,
        pageCountLabel: "10 pages",
        imageCallCount: 11,
        renderedVisualCount: 31,
      },
      normal: {
        readablePathLength: 18,
        branchCount: 5,
        branchImageCount: 0,
        graphPageCount: 28,
        pageCountLabel: "18 pages",
        imageCallCount: 19,
        renderedVisualCount: 55,
      },
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
      normal: {
        readablePathLength: 80,
        branchCount: 8,
        branchImageCount: 8,
        graphPageCount: 104,
        pageCountLabel: "~80 pages",
        imageCallCount: 9,
        renderedVisualCount: 9,
      },
      thick: {
        readablePathLength: 120,
        branchCount: 12,
        branchImageCount: 12,
        graphPageCount: 156,
        pageCountLabel: "~120 pages",
        imageCallCount: 13,
        renderedVisualCount: 13,
      },
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
      normal: {
        readablePathLength: 80,
        branchCount: 8,
        branchImageCount: 8,
        graphPageCount: 104,
        pageCountLabel: "~80 pages",
        imageCallCount: 9,
        renderedVisualCount: 9,
      },
      thick: {
        readablePathLength: 120,
        branchCount: 12,
        branchImageCount: 12,
        graphPageCount: 156,
        pageCountLabel: "~120 pages",
        imageCallCount: 13,
        renderedVisualCount: 13,
      },
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
      normal: {
        readablePathLength: 80,
        branchCount: 8,
        branchImageCount: 8,
        graphPageCount: 104,
        pageCountLabel: "~80 pages",
        imageCallCount: 9,
        renderedVisualCount: 9,
      },
      thick: {
        readablePathLength: 120,
        branchCount: 12,
        branchImageCount: 12,
        graphPageCount: 156,
        pageCountLabel: "~120 pages",
        imageCallCount: 13,
        renderedVisualCount: 13,
      },
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
      normal: {
        readablePathLength: 80,
        branchCount: 8,
        branchImageCount: 8,
        graphPageCount: 104,
        pageCountLabel: "~80 pages",
        imageCallCount: 9,
        renderedVisualCount: 9,
      },
      thick: {
        readablePathLength: 120,
        branchCount: 12,
        branchImageCount: 12,
        graphPageCount: 156,
        pageCountLabel: "~120 pages",
        imageCallCount: 13,
        renderedVisualCount: 13,
      },
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
