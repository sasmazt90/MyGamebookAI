import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInvokeLLM,
  mockGenerateImage,
  mockStoragePut,
  mockDb,
} = vi.hoisted(() => ({
  mockInvokeLLM: vi.fn(),
  mockGenerateImage: vi.fn(),
  mockStoragePut: vi.fn(),
  mockDb: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mockInvokeLLM,
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: mockGenerateImage,
}));

vi.mock("./storage", () => ({
  storagePut: mockStoragePut,
  storageDelete: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

import { generateBookContent } from "./routers/books";

describe("generateBookContent fairy_tale branch parent mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn(() => "image/png") },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }));

    mockStoragePut.mockResolvedValue({ url: "https://cdn.example.com/file.png", key: "file.png" });
    mockGenerateImage.mockResolvedValue({ url: "https://cdn.example.com/generated.png" });

    mockInvokeLLM.mockImplementation(async (_args: unknown) => {
      const callIndex = mockInvokeLLM.mock.calls.length;

      if (callIndex === 1) {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  pages: [
                    {
                      pageNumber: 1,
                      branchPath: "root",
                      isBranchPage: true,
                      isEnding: false,
                      content: "Küçük kahraman bir patikaya geldi.",
                      sfxTags: ["forest"],
                      choiceA: "Parlayan patikayı seç",
                      choiceB: "Sisli patikayı seç",
                      nextPageA: 2,
                      nextPageB: 3,
                    },
                    {
                      pageNumber: 2,
                      branchPath: "A",
                      isBranchPage: false,
                      isEnding: true,
                      content: "Parlayan patikada peri ışıkları dans etti.",
                      sfxTags: ["chimes"],
                      choiceA: null,
                      choiceB: null,
                      nextPageA: null,
                      nextPageB: null,
                    },
                    {
                      pageNumber: 3,
                      branchPath: "B",
                      isBranchPage: false,
                      isEnding: true,
                      content: "Sisli patikada rüzgâr usulca esti.",
                      sfxTags: ["wind"],
                      choiceA: null,
                      choiceB: null,
                      nextPageA: null,
                      nextPageB: null,
                    },
                  ],
                }),
              },
            },
          ],
        };
      }

      return {
        choices: [
          {
            message: {
              content: "Genişletilmiş içerik",
            },
          },
        ],
      };
    });
  });

  it("builds fairy branch context without ReferenceError", async () => {
    await expect(
      generateBookContent(999, {
        title: "Test Fairy",
        category: "fairy_tale",
        length: "thin",
        description: "Dallanan bir peri masalı",
        language: "tr",
        characters: [],
      })
    ).resolves.toBeUndefined();

    // First call is structure generation; at least one additional call means per-page
    // fairy expansion loop executed (where the regression occurred).
    expect(mockInvokeLLM.mock.calls.length).toBeGreaterThan(1);

    const expansionSystemPrompts = mockInvokeLLM.mock.calls
      .slice(1)
      .map((call) => (call[0] as any)?.messages?.[0]?.content)
      .filter((content): content is string => typeof content === "string");

    expect(
      expansionSystemPrompts.some((content) =>
        content.includes('The reader chose: "Parlayan patikayı seç"')
      )
    ).toBe(true);
  });
});
