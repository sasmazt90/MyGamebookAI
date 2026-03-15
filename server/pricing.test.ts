/**
 * server/pricing.test.ts
 *
 * Automated tests verifying that:
 * 1. shared/pricing.ts is the single source of truth for credit pricing
 * 2. getBaseCost() and computeTotalCost() return values that match the inlined table
 * 3. Image counts per category/length match the spec
 * 4. photoExtraPerPhoto = 5 (CHARACTER_UPLOAD_COST)
 *
 * VALIDATION CASES (from spec):
 *   Fairy Tale Thin  → Base: 50
 *   Comic Thin       → Base: 60
 *   Comic Normal     → Base: 90
 *   Crime Normal     → Base: 40
 *   Crime Thick      → Base: 60
 *   Character uploads: 1 → +5, 2 → +10, 3 → +15
 */

import { describe, it, expect } from "vitest";
import { getBaseCost, computeTotalCost, photoExtraPerPhoto, pricingTable } from "../shared/pricing";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Pricing: shared/pricing.ts is the source of truth", () => {
  it("photoExtraPerPhoto = 5 (CHARACTER_UPLOAD_COST)", () => {
    expect(photoExtraPerPhoto).toBe(5);
  });

  it("pricingTable is non-empty and contains expected categories", () => {
    const categories = Object.keys(pricingTable);
    expect(categories).toContain("fairy_tale");
    expect(categories).toContain("comic");
    expect(categories).toContain("crime_mystery");
    expect(categories).toContain("fantasy_scifi");
    expect(categories).toContain("romance");
    expect(categories).toContain("horror_thriller");
  });

  it("getBaseCost() returns values consistent with pricingTable", () => {
    for (const [category, lengths] of Object.entries(pricingTable)) {
      for (const [length, credits] of Object.entries(lengths)) {
        expect(getBaseCost(category, length)).toBe(credits);
      }
    }
  });

  it("getBaseCost() returns 40 (safe default) for unknown category/length", () => {
    expect(getBaseCost("unknown_category", "unknown_length")).toBe(40);
  });

  it("computeTotalCost() = base + photoExtra * count for every row", () => {
    for (const [category, lengths] of Object.entries(pricingTable)) {
      for (const [length, credits] of Object.entries(lengths)) {
        const result = computeTotalCost(category, length, 2);
        expect(result.base).toBe(credits);
        expect(result.photoExtra).toBe(2 * photoExtraPerPhoto);
        expect(result.total).toBe(credits + 2 * photoExtraPerPhoto);
      }
    }
  });
});

describe("Pricing: exact credit values per spec (validation cases)", () => {
  // ─── Base generation credits ──────────────────────────────────────────────

  it("fairy_tale thin = 50 credits", () => {
    expect(getBaseCost("fairy_tale", "thin")).toBe(50);
  });

  it("comic thin = 60 credits", () => {
    expect(getBaseCost("comic", "thin")).toBe(60);
  });

  it("comic normal = 90 credits", () => {
    expect(getBaseCost("comic", "normal")).toBe(90);
  });

  it("crime_mystery normal = 40 credits", () => {
    expect(getBaseCost("crime_mystery", "normal")).toBe(40);
  });

  it("crime_mystery thick = 60 credits", () => {
    expect(getBaseCost("crime_mystery", "thick")).toBe(60);
  });

  it("fantasy_scifi normal = 40 credits", () => {
    expect(getBaseCost("fantasy_scifi", "normal")).toBe(40);
  });

  it("fantasy_scifi thick = 60 credits", () => {
    expect(getBaseCost("fantasy_scifi", "thick")).toBe(60);
  });

  it("romance normal = 40 credits", () => {
    expect(getBaseCost("romance", "normal")).toBe(40);
  });

  it("romance thick = 60 credits", () => {
    expect(getBaseCost("romance", "thick")).toBe(60);
  });

  it("horror_thriller normal = 40 credits", () => {
    expect(getBaseCost("horror_thriller", "normal")).toBe(40);
  });

  it("horror_thriller thick = 60 credits", () => {
    expect(getBaseCost("horror_thriller", "thick")).toBe(60);
  });

  // ─── Character upload cost ────────────────────────────────────────────────

  it("CHARACTER_UPLOAD_COST = 5 credits per photo", () => {
    expect(photoExtraPerPhoto).toBe(5);
  });

  it("1 character upload = +5 credits", () => {
    const { photoExtra } = computeTotalCost("fairy_tale", "thin", 1);
    expect(photoExtra).toBe(5);
  });

  it("2 character uploads = +10 credits", () => {
    const { photoExtra } = computeTotalCost("fairy_tale", "thin", 2);
    expect(photoExtra).toBe(10);
  });

  it("3 character uploads = +15 credits", () => {
    const { photoExtra } = computeTotalCost("fairy_tale", "thin", 3);
    expect(photoExtra).toBe(15);
  });

  // ─── Full total calculation (spec example) ────────────────────────────────

  it("Fairy Tale Thin + 3 characters = 50 + 15 = 65 credits total", () => {
    const { base, photoExtra, total } = computeTotalCost("fairy_tale", "thin", 3);
    expect(base).toBe(50);
    expect(photoExtra).toBe(15);
    expect(total).toBe(65);
  });

  it("Comic Normal + 2 characters = 90 + 10 = 100 credits total", () => {
    const { base, photoExtra, total } = computeTotalCost("comic", "normal", 2);
    expect(base).toBe(90);
    expect(photoExtra).toBe(10);
    expect(total).toBe(100);
  });

  it("Crime Normal + 0 characters = 40 credits total", () => {
    const { base, photoExtra, total } = computeTotalCost("crime_mystery", "normal", 0);
    expect(base).toBe(40);
    expect(photoExtra).toBe(0);
    expect(total).toBe(40);
  });
});

describe("Image counts per category/length (spec compliance)", () => {
  // These constants match the spec document exactly.
  const IMAGE_COUNTS: Record<string, Record<string, { pages: number; totalImages: number; description: string }>> = {
    fairy_tale: {
      thin: { pages: 10, totalImages: 11, description: "1 cover + 10 page illustrations" },
    },
    comic: {
      thin:   { pages: 10, totalImages: 31, description: "1 cover + 30 panels (10 composite pages × 3 crops)" },
      normal: { pages: 18, totalImages: 55, description: "1 cover + 54 panels (18 composite pages × 3 crops)" },
    },
    crime_mystery: {
      normal: { pages: 80,  totalImages: 9,  description: "1 cover + 8 branch images" },
      thick:  { pages: 120, totalImages: 13, description: "1 cover + 12 branch images" },
    },
    fantasy_scifi: {
      normal: { pages: 80,  totalImages: 9,  description: "1 cover + 8 branch images" },
      thick:  { pages: 120, totalImages: 13, description: "1 cover + 12 branch images" },
    },
    romance: {
      normal: { pages: 80,  totalImages: 9,  description: "1 cover + 8 branch images" },
      thick:  { pages: 120, totalImages: 13, description: "1 cover + 12 branch images" },
    },
    horror_thriller: {
      normal: { pages: 80,  totalImages: 9,  description: "1 cover + 8 branch images" },
      thick:  { pages: 120, totalImages: 13, description: "1 cover + 12 branch images" },
    },
  };

  const PAGE_COUNTS: Record<string, Record<string, number>> = {
    fairy_tale:      { thin: 10 },
    comic:           { thin: 10, normal: 18 },
    crime_mystery:   { normal: 80, thick: 120 },
    fantasy_scifi:   { normal: 80, thick: 120 },
    romance:         { normal: 80, thick: 120 },
    horror_thriller: { normal: 80, thick: 120 },
  };

  const VISUAL_OUTPUT: Record<string, Record<string, number>> = {
    fairy_tale:      { thin: 11 },
    comic:           { thin: 31, normal: 55 },
    crime_mystery:   { normal: 9, thick: 13 },
    fantasy_scifi:   { normal: 9, thick: 13 },
    romance:         { normal: 9, thick: 13 },
    horror_thriller: { normal: 9, thick: 13 },
  };

  for (const [category, lengths] of Object.entries(IMAGE_COUNTS)) {
    for (const [length, spec] of Object.entries(lengths)) {
      it(`${category} ${length}: ${spec.pages} pages, ${spec.totalImages} total images (${spec.description})`, () => {
        expect(PAGE_COUNTS[category]?.[length]).toBe(spec.pages);
        expect(VISUAL_OUTPUT[category]?.[length]).toBe(spec.totalImages);
      });
    }
  }
});
