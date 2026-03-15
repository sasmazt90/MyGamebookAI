/**
 * shared/pricing.ts
 *
 * Single source of truth for Gamebook AI credit pricing.
 *
 * The pricing data is inlined here as a TypeScript constant so that it is
 * bundled into the production build and does NOT require any filesystem access
 * at runtime (avoids ENOENT errors in the deployed container).
 *
 * To change pricing: edit PRICING_TABLE and PHOTO_EXTRA_PER_PHOTO below.
 * Both the backend (server/routers/books.ts) and the frontend cost calculator
 * import from this module — never hardcode credit values elsewhere.
 *
 * Validation cases (from spec):
 *   fairy_tale  thin   → 50 credits
 *   comic       thin   → 60 credits
 *   comic       normal → 90 credits
 *   crime_mystery normal → 40 credits
 *   crime_mystery thick  → 60 credits
 *   Character upload cost: 5 credits per photo
 */

// ─── Pricing constants ────────────────────────────────────────────────────────

/** Extra credits charged per uploaded character photo. */
export const photoExtraPerPhoto = 5;

/**
 * Base generation credits per category + length combination.
 * Keyed as PRICING_TABLE[category][length] = base_credits.
 */
const PRICING_TABLE: Record<string, Record<string, number>> = {
  fairy_tale:      { thin: 50 },
  comic:           { thin: 60, normal: 90 },
  crime_mystery:   { normal: 40, thick: 60 },
  fantasy_scifi:   { normal: 40, thick: 60 },
  romance:         { normal: 40, thick: 60 },
  horror_thriller: { normal: 40, thick: 60 },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Credits charged for generating a book (excluding character photo add-ons). */
export function getBaseCost(category: string, length: string): number {
  return PRICING_TABLE[category]?.[length] ?? 40; // safe default = cheapest paid tier
}

/** Full pricing table (for tests and UI). */
export const pricingTable: Readonly<Record<string, Record<string, number>>> = PRICING_TABLE;

/**
 * Compute total credit cost for a book.
 * @param category            - book category (e.g. "comic", "fairy_tale")
 * @param length              - book length (e.g. "thin", "normal", "thick")
 * @param characterPhotoCount - number of uploaded character photos
 */
export function computeTotalCost(
  category: string,
  length: string,
  characterPhotoCount: number,
): { base: number; photoExtra: number; total: number } {
  const base = getBaseCost(category, length);
  const photoExtra = characterPhotoCount * photoExtraPerPhoto;
  return { base, photoExtra, total: base + photoExtra };
}
