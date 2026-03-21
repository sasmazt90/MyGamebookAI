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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: vi.fn(() => "image/png") },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      })
    );

    mockStoragePut.mockResolvedValue({ url: "https://cdn.example.com/file.png", key: "file.png" });
    mockGenerateImage.mockResolvedValue({ url: "https://cdn.example.com/generated.png" });

    mockInvokeLLM.mockImplementation(async () => {
      const callIndex = mockInvokeLLM.mock.calls.length;

      if (callIndex === 1) {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  pages: [
                    { pageNumber: 1, branchPath: "root", isBranchPage: false, isEnding: false, content: "Acilis.", sfxTags: ["forest"], choiceA: null, choiceB: null, nextPageA: 2, nextPageB: null },
                    { pageNumber: 2, branchPath: "root", isBranchPage: true, isEnding: false, content: "Kucuk kahraman bir patikaya geldi.", sfxTags: ["forest"], choiceA: "Parlayan patikayi sec", choiceB: "Sisli patikayi sec", nextPageA: 3, nextPageB: 11 },
                    { pageNumber: 3, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 1.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 4, nextPageB: null },
                    { pageNumber: 4, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 2.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 5, nextPageB: null },
                    { pageNumber: 5, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 3.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 6, nextPageB: null },
                    { pageNumber: 6, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 4.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 7, nextPageB: null },
                    { pageNumber: 7, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 5.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 8, nextPageB: null },
                    { pageNumber: 8, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 6.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 9, nextPageB: null },
                    { pageNumber: 9, branchPath: "A", isBranchPage: false, isEnding: false, content: "A yolu 7.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: 10, nextPageB: null },
                    { pageNumber: 10, branchPath: "A", isBranchPage: false, isEnding: true, content: "Parlayan patikada peri isiklari dans etti.", sfxTags: ["chimes"], choiceA: null, choiceB: null, nextPageA: null, nextPageB: null },
                    { pageNumber: 11, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 1.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 12, nextPageB: null },
                    { pageNumber: 12, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 2.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 13, nextPageB: null },
                    { pageNumber: 13, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 3.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 14, nextPageB: null },
                    { pageNumber: 14, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 4.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 15, nextPageB: null },
                    { pageNumber: 15, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 5.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 16, nextPageB: null },
                    { pageNumber: 16, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 6.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 17, nextPageB: null },
                    { pageNumber: 17, branchPath: "B", isBranchPage: false, isEnding: false, content: "B yolu 7.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: 18, nextPageB: null },
                    { pageNumber: 18, branchPath: "B", isBranchPage: false, isEnding: true, content: "Sisli patikada ruzgar usulca esti.", sfxTags: ["wind"], choiceA: null, choiceB: null, nextPageA: null, nextPageB: null },
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
              content: "Genisletilmis icerik",
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
        description: "Dallanan bir peri masali",
        language: "tr",
        characters: [],
      })
    ).resolves.toBeUndefined();

    expect(mockInvokeLLM.mock.calls.length).toBeGreaterThan(1);

    const expansionSystemPrompts = mockInvokeLLM.mock.calls
      .slice(1)
      .map((call) => (call[0] as any)?.messages?.[0]?.content)
      .filter((content): content is string => typeof content === "string");

    expect(
      expansionSystemPrompts.some((content) =>
        content.includes('The reader chose: "Parlayan patikayi sec"')
      )
    ).toBe(true);
  });
});
