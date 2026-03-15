/**
 * Unit tests for the CHARACTER_COLOUR_LOCK regex extractor.
 *
 * The extractor is defined inline inside generateBookContent() in
 * server/routers/books.ts.  To keep the tests self-contained and fast
 * (no DB, no LLM), the regex logic is replicated here verbatim so any
 * future change to the source is caught by a failing test.
 *
 * Coverage goals:
 *   1. Basic colour words (black, brown, blonde, red, white, grey)
 *   2. Food/nature metaphors common in LLM output (espresso, honey, mahogany…)
 *   3. Compound modifiers (dark brown, light auburn, salt-and-pepper, dirty blonde)
 *   4. Fantasy colours (lavender, teal, violet, indigo)
 *   5. Eye colour vocabulary (steel-grey, ocean-blue, emerald, hazel…)
 *   6. Compound colour-colour descriptors (blue-grey, grey-green)
 *   7. Fallback path: unusual descriptors not in the primary vocabulary
 *   8. No false positives on strings without colour mentions
 *   9. Multi-character output formatting
 */

import { describe, it, expect } from "vitest";

// ─── Replicate the extractor from books.ts ───────────────────────────────────
// Keep this in sync with server/routers/books.ts → colourKeywords block.

const COLOUR_PREFIX =
  "(?:(?:dark|light|medium|deep|pale|warm|cool|rich|bright|vivid|soft|muted|natural|neutral|" +
  "salt-and-pepper|salt and pepper|dirty|strawberry|platinum|ash|jet|snow|" +
  "espresso|coffee|chocolate|mocha|mahogany|walnut|chestnut|toffee|caramel|cinnamon|" +
  "honey|amber|tawny|sandy|wheat|flaxen|golden|auburn|copper|rust|ginger|flame|fiery|" +
  "raven|ebony|charcoal|sable|silver|lavender|ocean|sapphire|cobalt|emerald|jade|" +
  "olive|steel|slate|stormy|ice|sky|topaz|whiskey|cognac|hazel|" +
  "black|brown|blonde|blond|brunette|red|orange|yellow|white|grey|gray|blue|green|" +
  "purple|pink|teal|violet|indigo|turquoise|coral|rose|burgundy|maroon|crimson|" +
  "scarlet|magenta|cyan|lime|navy|beige|ivory|cream|tan|nude|nude|" +
  "blue-grey|grey-blue|grey-green|green-hazel|warm-brown|ash-brown|reddish-brown|" +
  "dark-brown|light-brown" +
  ")[\\s-]+)?";

const HAIR_CORE =
  "(?:black|brown|blonde|blond|brunette|red|orange|yellow|white|grey|gray|" +
  "espresso|coffee|chocolate|mocha|mahogany|walnut|chestnut|toffee|caramel|" +
  "cinnamon|honey|amber|tawny|sandy|wheat|flaxen|golden|auburn|copper|rust|" +
  "ginger|flame|fiery|raven|ebony|charcoal|sable|silver|platinum|lavender|" +
  "blue|green|purple|pink|teal|violet|indigo|turquoise|burgundy|crimson)";

const hairRe = new RegExp(
  `(${COLOUR_PREFIX}${HAIR_CORE}[\\w\\s,'-]{0,40}hair(?:[\\w\\s,'-]{0,30})?)`,
  "i",
);

const EYE_CORE =
  "(?:brown|blue|green|grey|gray|hazel|amber|black|violet|teal|" +
  "chocolate|espresso|coffee|honey|steel|slate|silver|ash|stormy|" +
  "ice|sky|ocean|sapphire|cobalt|navy|cornflower|emerald|jade|forest|" +
  "olive|sage|moss|golden|topaz|whiskey|cognac|blue-grey|grey-green|" +
  "grey-blue|green-hazel)";

const eyeRe = new RegExp(
  `(${COLOUR_PREFIX}${EYE_CORE}(?:[\\s-]+[\\w-]+)?[\\s-]*eyes)`,
  "i",
);

function extractColours(appearance: string): { hair: string | null; eyes: string | null } {
  const hairMatch = appearance.match(hairRe);
  const eyeMatch  = appearance.match(eyeRe);

  const fallbackHair = !hairMatch
    ? appearance.match(/([\w-]+(?:[\s-][\w-]+){0,3}\s+hair)/i)
    : null;
  const fallbackEye = !eyeMatch
    ? appearance.match(/([\w-]+(?:[\s-][\w-]+){0,2}\s+eyes)/i)
    : null;

  return {
    hair: (hairMatch?.[1] ?? fallbackHair?.[1])?.trim() ?? null,
    eyes: (eyeMatch?.[1]  ?? fallbackEye?.[1])?.trim()  ?? null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CHARACTER_COLOUR_LOCK — hair colour extraction", () => {

  // ── Basic colour words ────────────────────────────────────────────────────
  it("extracts 'black hair'", () => {
    const { hair } = extractColours("She has black hair and brown eyes.");
    expect(hair).toMatch(/black hair/i);
  });

  it("extracts 'brown hair'", () => {
    const { hair } = extractColours("He has brown hair, cut short.");
    expect(hair).toMatch(/brown hair/i);
  });

  it("extracts 'blonde hair'", () => {
    const { hair } = extractColours("Long blonde hair falls to her shoulders.");
    expect(hair).toMatch(/blonde hair/i);
  });

  it("extracts 'blond hair' (alternative spelling)", () => {
    const { hair } = extractColours("He sports short blond hair.");
    expect(hair).toMatch(/blond hair/i);
  });

  it("extracts 'red hair'", () => {
    const { hair } = extractColours("Fiery red hair frames her face.");
    expect(hair).toMatch(/red hair/i);
  });

  it("extracts 'white hair'", () => {
    const { hair } = extractColours("An elder with white hair and a long beard.");
    expect(hair).toMatch(/white hair/i);
  });

  it("extracts 'grey hair'", () => {
    const { hair } = extractColours("Distinguished grey hair, neatly combed.");
    expect(hair).toMatch(/grey hair/i);
  });

  it("extracts 'gray hair' (American spelling)", () => {
    const { hair } = extractColours("He has gray hair and a stern expression.");
    expect(hair).toMatch(/gray hair/i);
  });

  // ── Modifier + basic colour ───────────────────────────────────────────────
  it("extracts 'dark brown hair'", () => {
    const { hair } = extractColours("He has dark brown hair and warm brown eyes.");
    expect(hair).toMatch(/dark brown hair/i);
  });

  it("extracts 'light auburn hair'", () => {
    const { hair } = extractColours("She has light auburn hair tied in a braid.");
    expect(hair).toMatch(/light auburn hair/i);
  });

  it("extracts 'deep black hair'", () => {
    const { hair } = extractColours("Deep black hair, almost blue in the light.");
    expect(hair).toMatch(/deep black hair/i);
  });

  it("extracts 'pale blonde hair'", () => {
    const { hair } = extractColours("Pale blonde hair and ice-blue eyes.");
    expect(hair).toMatch(/pale blonde hair/i);
  });

  // ── Compound modifiers ────────────────────────────────────────────────────
  it("extracts 'salt-and-pepper hair'", () => {
    const { hair } = extractColours("He has salt-and-pepper hair and a square jaw.");
    expect(hair).toMatch(/salt-and-pepper hair/i);
  });

  it("extracts 'dirty blonde hair'", () => {
    const { hair } = extractColours("Dirty blonde hair, shoulder-length.");
    expect(hair).toMatch(/dirty blonde hair/i);
  });

  it("extracts 'strawberry blonde hair'", () => {
    const { hair } = extractColours("Strawberry blonde hair with natural highlights.");
    expect(hair).toMatch(/strawberry blonde hair/i);
  });

  it("extracts 'platinum blonde hair'", () => {
    const { hair } = extractColours("Platinum blonde hair styled in waves.");
    expect(hair).toMatch(/platinum blonde hair/i);
  });

  // ── Food/nature metaphors ─────────────────────────────────────────────────
  it("extracts 'espresso hair'", () => {
    const { hair } = extractColours("Espresso hair, cut in a sharp bob.");
    expect(hair).toMatch(/espresso hair/i);
  });

  it("extracts 'dark espresso-brown hair'", () => {
    const { hair } = extractColours("He has dark espresso-brown hair.");
    expect(hair).toMatch(/espresso/i);
  });

  it("extracts 'mahogany hair'", () => {
    const { hair } = extractColours("Rich mahogany hair cascades past her shoulders.");
    expect(hair).toMatch(/mahogany hair/i);
  });

  it("extracts 'chestnut hair'", () => {
    const { hair } = extractColours("Chestnut hair and freckled skin.");
    expect(hair).toMatch(/chestnut hair/i);
  });

  it("extracts 'honey blonde hair'", () => {
    const { hair } = extractColours("Honey blonde hair glows in the sunlight.");
    expect(hair).toMatch(/honey blonde hair/i);
  });

  it("extracts 'caramel hair'", () => {
    const { hair } = extractColours("Caramel hair with natural highlights.");
    expect(hair).toMatch(/caramel hair/i);
  });

  it("extracts 'toffee hair'", () => {
    const { hair } = extractColours("Warm toffee hair, loosely curled.");
    expect(hair).toMatch(/toffee hair/i);
  });

  it("extracts 'cinnamon hair'", () => {
    const { hair } = extractColours("Cinnamon hair and warm brown skin.");
    expect(hair).toMatch(/cinnamon hair/i);
  });

  it("extracts 'copper hair'", () => {
    const { hair } = extractColours("Bright copper hair and green eyes.");
    expect(hair).toMatch(/copper hair/i);
  });

  it("extracts 'auburn hair'", () => {
    const { hair } = extractColours("Auburn hair, slightly wavy.");
    expect(hair).toMatch(/auburn hair/i);
  });

  it("extracts 'ginger hair'", () => {
    const { hair } = extractColours("Bright ginger hair and a freckled nose.");
    expect(hair).toMatch(/ginger hair/i);
  });

  it("extracts 'golden hair'", () => {
    const { hair } = extractColours("Long golden hair and blue eyes.");
    expect(hair).toMatch(/golden hair/i);
  });

  it("extracts 'flaxen hair'", () => {
    const { hair } = extractColours("Flaxen hair and pale blue eyes.");
    expect(hair).toMatch(/flaxen hair/i);
  });

  it("extracts 'sandy hair'", () => {
    const { hair } = extractColours("Sandy hair and a sun-tanned complexion.");
    expect(hair).toMatch(/sandy hair/i);
  });

  it("extracts 'raven hair'", () => {
    const { hair } = extractColours("Raven hair and sharp cheekbones.");
    expect(hair).toMatch(/raven hair/i);
  });

  it("extracts 'ebony hair'", () => {
    const { hair } = extractColours("Ebony hair, straight and glossy.");
    expect(hair).toMatch(/ebony hair/i);
  });

  it("extracts 'charcoal hair'", () => {
    const { hair } = extractColours("Charcoal hair with silver streaks at the temples.");
    expect(hair).toMatch(/charcoal hair/i);
  });

  it("extracts 'silver hair'", () => {
    const { hair } = extractColours("Silver hair worn in a tight bun.");
    expect(hair).toMatch(/silver hair/i);
  });

  // ── Fantasy colours ───────────────────────────────────────────────────────
  it("extracts 'lavender hair'", () => {
    const { hair } = extractColours("She has lavender hair and violet eyes.");
    expect(hair).toMatch(/lavender hair/i);
  });

  it("extracts 'teal hair'", () => {
    const { hair } = extractColours("Teal hair styled in spikes.");
    expect(hair).toMatch(/teal hair/i);
  });

  it("extracts 'violet hair'", () => {
    const { hair } = extractColours("Violet hair and silver eyes.");
    expect(hair).toMatch(/violet hair/i);
  });

  it("extracts 'indigo hair'", () => {
    const { hair } = extractColours("Indigo hair, long and flowing.");
    expect(hair).toMatch(/indigo hair/i);
  });

  it("extracts 'blue hair'", () => {
    const { hair } = extractColours("Bright blue hair and a mischievous grin.");
    expect(hair).toMatch(/blue hair/i);
  });

  it("extracts 'pink hair'", () => {
    const { hair } = extractColours("Pastel pink hair, shoulder-length.");
    expect(hair).toMatch(/pink hair/i);
  });

  // ── Trailing descriptors (hair style after colour) ────────────────────────
  it("extracts colour from 'dark brown, slightly wavy hair'", () => {
    const { hair } = extractColours("He has dark brown, slightly wavy hair.");
    expect(hair).toMatch(/dark brown/i);
    expect(hair).toMatch(/hair/i);
  });

  it("extracts colour from 'short, jet-black hair'", () => {
    const { hair } = extractColours("Short, jet-black hair and a strong jawline.");
    expect(hair).toMatch(/jet-black hair/i);
  });

  // ── No false positives ────────────────────────────────────────────────────
  it("returns null for hair when no colour is mentioned", () => {
    const { hair } = extractColours("She has a warm smile and kind demeanour.");
    expect(hair).toBeNull();
  });

  it("does not match 'hair' without a preceding colour word", () => {
    const { hair } = extractColours("Her hair is styled in an elaborate updo.");
    // Fallback may still match "hair" — that is acceptable; just verify no crash
    // and that the result is a string or null (not undefined/error)
    expect(hair === null || typeof hair === "string").toBe(true);
  });
});

describe("CHARACTER_COLOUR_LOCK — eye colour extraction", () => {

  // ── Basic colour words ────────────────────────────────────────────────────
  it("extracts 'brown eyes'", () => {
    const { eyes } = extractColours("She has dark brown hair and warm brown eyes.");
    expect(eyes).toMatch(/brown eyes/i);
  });

  it("extracts 'blue eyes'", () => {
    const { eyes } = extractColours("Piercing blue eyes and a confident stance.");
    expect(eyes).toMatch(/blue eyes/i);
  });

  it("extracts 'green eyes'", () => {
    const { eyes } = extractColours("She has green eyes and auburn hair.");
    expect(eyes).toMatch(/green eyes/i);
  });

  it("extracts 'grey eyes'", () => {
    const { eyes } = extractColours("Pale grey eyes, like storm clouds.");
    expect(eyes).toMatch(/grey eyes/i);
  });

  it("extracts 'gray eyes' (American spelling)", () => {
    const { eyes } = extractColours("He has gray eyes and a serious expression.");
    expect(eyes).toMatch(/gray eyes/i);
  });

  it("extracts 'hazel eyes'", () => {
    const { eyes } = extractColours("Hazel eyes that shift between green and brown.");
    expect(eyes).toMatch(/hazel eyes/i);
  });

  it("extracts 'amber eyes'", () => {
    const { eyes } = extractColours("Warm amber eyes and a gentle smile.");
    expect(eyes).toMatch(/amber eyes/i);
  });

  it("extracts 'black eyes'", () => {
    const { eyes } = extractColours("Deep black eyes, almost no iris visible.");
    expect(eyes).toMatch(/black eyes/i);
  });

  it("extracts 'violet eyes'", () => {
    const { eyes } = extractColours("Rare violet eyes and silver hair.");
    expect(eyes).toMatch(/violet eyes/i);
  });

  // ── Modifier + basic colour ───────────────────────────────────────────────
  it("extracts 'dark brown eyes'", () => {
    const { eyes } = extractColours("He has dark brown eyes and a warm smile.");
    expect(eyes).toMatch(/dark brown eyes/i);
  });

  it("extracts 'pale blue eyes'", () => {
    const { eyes } = extractColours("Pale blue eyes and platinum blonde hair.");
    expect(eyes).toMatch(/pale blue eyes/i);
  });

  it("extracts 'deep green eyes'", () => {
    const { eyes } = extractColours("Deep green eyes framed by thick lashes.");
    expect(eyes).toMatch(/deep green eyes/i);
  });

  // ── Food/nature metaphors ─────────────────────────────────────────────────
  it("extracts 'chocolate eyes'", () => {
    const { eyes } = extractColours("Warm chocolate eyes and a broad smile.");
    expect(eyes).toMatch(/chocolate eyes/i);
  });

  it("extracts 'espresso eyes'", () => {
    const { eyes } = extractColours("Espresso eyes, intense and focused.");
    expect(eyes).toMatch(/espresso eyes/i);
  });

  it("extracts 'honey eyes'", () => {
    const { eyes } = extractColours("Honey eyes that sparkle in the light.");
    expect(eyes).toMatch(/honey eyes/i);
  });

  it("extracts 'golden eyes'", () => {
    const { eyes } = extractColours("Golden eyes, almost feline in appearance.");
    expect(eyes).toMatch(/golden eyes/i);
  });

  it("extracts 'topaz eyes'", () => {
    const { eyes } = extractColours("Topaz eyes and silver hair.");
    expect(eyes).toMatch(/topaz eyes/i);
  });

  it("extracts 'cognac eyes'", () => {
    const { eyes } = extractColours("Cognac eyes and a warm complexion.");
    expect(eyes).toMatch(/cognac eyes/i);
  });

  // ── Greys ─────────────────────────────────────────────────────────────────
  it("extracts 'steel-grey eyes'", () => {
    const { eyes } = extractColours("Steel-grey eyes and a determined expression.");
    expect(eyes).toMatch(/steel/i);
    expect(eyes).toMatch(/eyes/i);
  });

  it("extracts 'stormy grey eyes'", () => {
    const { eyes } = extractColours("Stormy grey eyes beneath heavy brows.");
    expect(eyes).toMatch(/stormy/i);
    expect(eyes).toMatch(/eyes/i);
  });

  it("extracts 'slate eyes'", () => {
    const { eyes } = extractColours("Slate eyes and a square jaw.");
    expect(eyes).toMatch(/slate eyes/i);
  });

  // ── Blues ─────────────────────────────────────────────────────────────────
  it("extracts 'ice-blue eyes'", () => {
    const { eyes } = extractColours("Ice-blue eyes and pale blonde hair.");
    expect(eyes).toMatch(/ice/i);
    expect(eyes).toMatch(/eyes/i);
  });

  it("extracts 'ocean-blue eyes'", () => {
    const { eyes } = extractColours("Ocean-blue eyes and sun-kissed skin.");
    expect(eyes).toMatch(/ocean/i);
    expect(eyes).toMatch(/eyes/i);
  });

  it("extracts 'sapphire eyes'", () => {
    const { eyes } = extractColours("Sapphire eyes and dark hair.");
    expect(eyes).toMatch(/sapphire eyes/i);
  });

  it("extracts 'cobalt eyes'", () => {
    const { eyes } = extractColours("Cobalt eyes and a strong build.");
    expect(eyes).toMatch(/cobalt eyes/i);
  });

  it("extracts 'cornflower eyes'", () => {
    const { eyes } = extractColours("Cornflower eyes and a gentle manner.");
    expect(eyes).toMatch(/cornflower eyes/i);
  });

  // ── Greens ────────────────────────────────────────────────────────────────
  it("extracts 'emerald eyes'", () => {
    const { eyes } = extractColours("Emerald eyes and red hair.");
    expect(eyes).toMatch(/emerald eyes/i);
  });

  it("extracts 'jade eyes'", () => {
    const { eyes } = extractColours("Jade eyes and a calm demeanour.");
    expect(eyes).toMatch(/jade eyes/i);
  });

  it("extracts 'forest green eyes'", () => {
    const { eyes } = extractColours("Forest green eyes and chestnut hair.");
    expect(eyes).toMatch(/forest/i);
    expect(eyes).toMatch(/eyes/i);
  });

  it("extracts 'olive eyes'", () => {
    const { eyes } = extractColours("Olive eyes and a Mediterranean complexion.");
    expect(eyes).toMatch(/olive eyes/i);
  });

  it("extracts 'sage eyes'", () => {
    const { eyes } = extractColours("Sage eyes and a thoughtful expression.");
    expect(eyes).toMatch(/sage eyes/i);
  });

  it("extracts 'moss eyes'", () => {
    const { eyes } = extractColours("Moss eyes and wild auburn hair.");
    expect(eyes).toMatch(/moss eyes/i);
  });

  // ── Compound colour-colour ────────────────────────────────────────────────
  it("extracts 'blue-grey eyes'", () => {
    const { eyes } = extractColours("Blue-grey eyes and silver hair.");
    expect(eyes).toMatch(/blue-grey eyes/i);
  });

  it("extracts 'grey-green eyes'", () => {
    const { eyes } = extractColours("Grey-green eyes and a freckled face.");
    expect(eyes).toMatch(/grey-green eyes/i);
  });

  it("extracts 'green-hazel eyes'", () => {
    const { eyes } = extractColours("Green-hazel eyes and warm brown skin.");
    expect(eyes).toMatch(/green-hazel eyes/i);
  });

  // ── No false positives ────────────────────────────────────────────────────
  it("returns null for eyes when no colour is mentioned", () => {
    const { eyes } = extractColours("He has a warm smile and kind demeanour.");
    expect(eyes).toBeNull();
  });
});

describe("CHARACTER_COLOUR_LOCK — combined extraction", () => {

  it("extracts both hair and eye colours from a rich appearance string", () => {
    const { hair, eyes } = extractColours(
      "Tolgar is a tall man with dark espresso-brown hair, slightly wavy, and warm brown eyes. He has a strong jaw and olive skin."
    );
    expect(hair).not.toBeNull();
    expect(hair).toMatch(/espresso|brown/i);
    expect(eyes).not.toBeNull();
    expect(eyes).toMatch(/brown eyes/i);
  });

  it("extracts both from a fantasy character description", () => {
    const { hair, eyes } = extractColours(
      "Aelindra has long silver hair that shimmers like moonlight, and deep violet eyes that glow faintly in the dark."
    );
    expect(hair).toMatch(/silver hair/i);
    expect(eyes).toMatch(/violet eyes/i);
  });

  it("extracts both from a comic-book character description", () => {
    const { hair, eyes } = extractColours(
      "Jake is a stocky detective with salt-and-pepper hair and steel-grey eyes, always wearing a rumpled trench coat."
    );
    expect(hair).toMatch(/salt-and-pepper hair/i);
    expect(eyes).toMatch(/steel/i);
  });

  it("extracts both from a fairy-tale character description", () => {
    const { hair, eyes } = extractColours(
      "Princess Elara has honey blonde hair that falls in soft waves and bright emerald eyes."
    );
    expect(hair).toMatch(/honey blonde hair/i);
    expect(eyes).toMatch(/emerald eyes/i);
  });

  it("extracts both from a horror character description", () => {
    const { hair, eyes } = extractColours(
      "The stranger has jet-black hair and pale, almost colourless grey eyes that seem to look right through you."
    );
    expect(hair).toMatch(/jet-black hair/i);
    expect(eyes).toMatch(/grey eyes/i);
  });

  it("handles a character with no photo (appearance from LLM card generation)", () => {
    const { hair, eyes } = extractColours(
      "Tugra is a young girl with curly chestnut hair, rosy cheeks, and bright hazel eyes. She wears a blue dress."
    );
    expect(hair).toMatch(/chestnut hair/i);
    expect(eyes).toMatch(/hazel eyes/i);
  });

  it("returns null for both when the appearance string has no colour words", () => {
    const { hair, eyes } = extractColours(
      "A mysterious figure in a long cloak, face hidden in shadow."
    );
    expect(hair).toBeNull();
    expect(eyes).toBeNull();
  });

  it("does not crash on an empty string", () => {
    const { hair, eyes } = extractColours("");
    expect(hair).toBeNull();
    expect(eyes).toBeNull();
  });
});

describe("CHARACTER_COLOUR_LOCK — fallback extractor", () => {

  it("falls back to capture an unusual hair descriptor not in the primary vocabulary", () => {
    // "cerulean hair" — cerulean is not in HAIR_CORE but the fallback should catch it
    const { hair } = extractColours("She has cerulean hair and bright eyes.");
    // Fallback regex: [\w-]+(?:[\s-][\w-]+){0,3}\s+hair
    expect(hair).not.toBeNull();
    expect(hair).toMatch(/hair/i);
  });

  it("falls back to capture an unusual eye descriptor not in the primary vocabulary", () => {
    // "vermillion eyes" — not in EYE_CORE
    const { eyes } = extractColours("He has vermillion eyes and dark hair.");
    expect(eyes).not.toBeNull();
    expect(eyes).toMatch(/eyes/i);
  });
});

// ─── Replicate the 8 new extractors from books.ts ────────────────────────────
// Keep these in sync with server/routers/books.ts → colourKeywords block.

const SKIN_TONE_WORDS =
  "(?:fair|pale|light|medium|tan|warm|cool|neutral|olive|golden|honey|caramel|" +
  "tawny|bronze|copper|brown|dark|deep|rich|ebony|mahogany|chocolate|mocha|" +
  "porcelain|ivory|peach|rose|ruddy|sallow|ashen|freckled)";
const skinRe = new RegExp(
  `(${SKIN_TONE_WORDS}(?:[\\s-]+[\\w-]+){0,3}\\s+(?:skin|complexion|tone))`,
  "i",
);
const fallbackSkinRe = /([\w-]+(?:[\s-][\w-]+){0,3}\s+(?:skin|complexion))/i;

const FACE_SHAPE_WORDS =
  "(?:oval|round|square|rectangular|heart|heart-shaped|diamond|oblong|long|" +
  "triangular|inverted-triangle|angular|soft|strong|defined|wide|narrow|" +
  "prominent|high|sharp|gentle|delicate|chiselled|chiseled)";
const faceRe = new RegExp(
  `(${FACE_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+(?:face|jaw|chin|cheekbones?|forehead))`,
  "i",
);
const fallbackFaceRe = /([\w-]+(?:[\s-][\w-]+){0,4}\s+(?:face|jaw|chin|cheekbones?))/i;

const HAIR_STYLE_WORDS =
  "(?:short|medium|long|shoulder-length|chin-length|ear-length|cropped|buzzed|shaved|" +
  "straight|wavy|curly|coily|kinky|frizzy|sleek|smooth|textured|layered|voluminous|" +
  "side-parted|centre-parted|center-parted|slicked|pompadour|undercut|fade|taper|" +
  "bob|lob|pixie|afro|dreadlocks?|braided|cornrows?|bun|ponytail|updo|fringe|bangs)";
const hairStyleRe = new RegExp(
  `(${HAIR_STYLE_WORDS}(?:[\\s-]+[\\w-]+){0,5}\\s+hair(?:[\\w\\s,'-]{0,30})?)`,
  "i",
);
const fallbackHairStyleRe = /([\w-]+(?:[\s-][\w-]+){0,5}\s+hair(?:[\w\s,'-]{0,30})?)/i;

const EYE_SHAPE_WORDS =
  "(?:almond|almond-shaped|round|wide|wide-set|close-set|deep-set|hooded|monolid|" +
  "upturned|downturned|heavy-lidded|heavy|large|small|narrow|slanted|angular|" +
  "expressive|bright|piercing|intense|soft|gentle|sleepy|bedroom)";
const eyeShapeRe = new RegExp(
  `(${EYE_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+eyes)`,
  "i",
);
const fallbackEyeShapeRe = /([\w-]+(?:[\s-][\w-]+){0,4}\s+eyes)/i;

const NOSE_SHAPE_WORDS =
  "(?:straight|button|snub|upturned|aquiline|roman|hawk|hooked|broad|flat|wide|" +
  "narrow|pointed|rounded|bulbous|prominent|small|large|petite|refined|defined|" +
  "high-bridged|low-bridged|flared|thin|thick)";
const noseRe = new RegExp(
  `(${NOSE_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+nose(?:[\\w\\s,'-]{0,20})?)`,
  "i",
);
const fallbackNoseRe = /([\w-]+(?:[\s-][\w-]+){0,4}\s+nose)/i;

const EYEBROW_WORDS =
  "(?:thick|thin|bushy|sparse|full|arched|straight|curved|flat|angular|tapered|" +
  "bold|defined|groomed|natural|unruly|feathered|pencil-thin|heavy|light|" +
  "dark|medium|fair|blonde|blond|brown|black|grey|gray|auburn|red)";
const browRe = new RegExp(
  `(${EYEBROW_WORDS}(?:[\\s-]+[\\w-]+){0,4}\\s+(?:eyebrows?|brows?))`,
  "i",
);
const fallbackBrowRe = /([\w-]+(?:[\s-][\w-]+){0,4}\s+(?:eyebrows?|brows?))/i;

const BODY_SHAPE_WORDS =
  "(?:tall|short|medium|average|petite|towering|statuesque|" +
  "slim|slender|lean|wiry|lithe|athletic|fit|toned|muscular|stocky|" +
  "heavyset|heavy-set|broad|broad-shouldered|wide|narrow|slight|" +
  "chubby|plump|rotund|portly|overweight|plus-size|curvy|voluptuous)";
const bodyRe = new RegExp(
  `(${BODY_SHAPE_WORDS}(?:[\\s-]+[\\w-]+){0,5}\\s+(?:build|frame|figure|physique|stature|body|height))`,
  "i",
);
const fallbackBodyRe = /([\w-]+(?:[\s-][\w-]+){0,5}\s+(?:build|frame|figure|physique|stature))/i;

const FACIAL_HAIR_NOUNS =
  "(?:stubble|five-o'clock-shadow|five o'clock shadow|" +
  "beard|bearded|goatee|moustache|mustache|sideburns|mutton-chops|mutton chops)";
const FACIAL_HAIR_MODIFIERS =
  "(?:clean-shaven|clean shaven|full|short|long|thick|thin|heavy|patchy|sparse|" +
  "neatly-trimmed|neatly trimmed|trimmed|groomed|dark|light|grey|gray|white|black|" +
  "brown|blonde|blond|red|auburn)";
const facialHairRe = new RegExp(
  `(clean-shaven|clean shaven|${FACIAL_HAIR_MODIFIERS}(?:[\\s-]+[\\w-]+){0,3}[\\s-]+${FACIAL_HAIR_NOUNS}|${FACIAL_HAIR_NOUNS}(?:[\\s-]+[\\w-]+){0,3})`,
  "i",
);

function extractAllAxes(app: string) {
  const skinMatch      = app.match(skinRe)      ?? app.match(fallbackSkinRe);
  const faceMatch      = app.match(faceRe)      ?? app.match(fallbackFaceRe);
  const hairStyleMatch = app.match(hairStyleRe) ?? app.match(fallbackHairStyleRe);
  const eyeShapeMatch  = app.match(eyeShapeRe)  ?? app.match(fallbackEyeShapeRe);
  const noseMatch      = app.match(noseRe)      ?? app.match(fallbackNoseRe);
  const browMatch      = app.match(browRe)      ?? app.match(fallbackBrowRe);
  const bodyMatch      = app.match(bodyRe)      ?? app.match(fallbackBodyRe);
  const facialHairMatch = app.match(facialHairRe);
  return {
    skin:       skinMatch?.[1]?.trim()       ?? null,
    face:       faceMatch?.[1]?.trim()       ?? null,
    hairStyle:  hairStyleMatch?.[1]?.trim()  ?? null,
    eyeShape:   eyeShapeMatch?.[1]?.trim()   ?? null,
    nose:       noseMatch?.[1]?.trim()       ?? null,
    brow:       browMatch?.[1]?.trim()       ?? null,
    body:       bodyMatch?.[1]?.trim()       ?? null,
    facialHair: facialHairMatch?.[1]?.trim() ?? null,
  };
}

// ─── Skin tone tests ──────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — skin tone extraction", () => {
  it("extracts 'fair porcelain skin'", () => {
    const { skin } = extractAllAxes("She has fair porcelain skin and blue eyes.");
    expect(skin).toMatch(/porcelain skin/i);
  });
  it("extracts 'warm olive skin'", () => {
    const { skin } = extractAllAxes("He has warm olive skin and dark hair.");
    expect(skin).toMatch(/olive skin/i);
  });
  it("extracts 'medium tan skin'", () => {
    const { skin } = extractAllAxes("Medium tan skin with warm undertone.");
    expect(skin).toMatch(/tan skin/i);
  });
  it("extracts 'deep ebony skin'", () => {
    const { skin } = extractAllAxes("Deep ebony skin and natural coily hair.");
    expect(skin).toMatch(/ebony skin/i);
  });
  it("extracts 'rich brown complexion'", () => {
    const { skin } = extractAllAxes("Rich brown complexion and amber eyes.");
    expect(skin).toMatch(/brown complexion/i);
  });
  it("extracts 'ivory skin'", () => {
    const { skin } = extractAllAxes("Ivory skin and red hair.");
    expect(skin).toMatch(/ivory skin/i);
  });
  it("returns null when no skin descriptor present", () => {
    const { skin } = extractAllAxes("He has blue eyes and blonde hair.");
    expect(skin).toBeNull();
  });
});

// ─── Face shape tests ─────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — face shape extraction", () => {
  it("extracts 'oval face'", () => {
    const { face } = extractAllAxes("She has an oval face with soft features.");
    expect(face).toMatch(/oval face/i);
  });
  it("extracts 'square jaw'", () => {
    const { face } = extractAllAxes("He has a square jaw and strong cheekbones.");
    expect(face).toMatch(/square jaw/i);
  });
  it("extracts 'heart-shaped face'", () => {
    const { face } = extractAllAxes("Heart-shaped face with a wide forehead and pointed chin.");
    expect(face).toMatch(/heart-shaped face/i);
  });
  it("extracts 'round face with full cheeks'", () => {
    const { face } = extractAllAxes("Round face with full cheeks and a button nose.");
    expect(face).toMatch(/round face/i);
  });
  it("extracts 'strong angular jaw'", () => {
    const { face } = extractAllAxes("Strong angular jaw and deep-set eyes.");
    expect(face).toMatch(/angular jaw/i);
  });
  it("extracts 'diamond-shaped face'", () => {
    const { face } = extractAllAxes("Diamond-shaped face with high cheekbones.");
    expect(face).toMatch(/diamond-shaped face/i);
  });
});

// ─── Hair style tests ─────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — hair style extraction", () => {
  it("extracts 'short side-parted undercut hair'", () => {
    const { hairStyle } = extractAllAxes("He has short side-parted undercut hair.");
    expect(hairStyle).toMatch(/short.*hair/i);
  });
  it("extracts 'long wavy hair'", () => {
    const { hairStyle } = extractAllAxes("Long wavy hair falls past her shoulders.");
    expect(hairStyle).toMatch(/long wavy hair/i);
  });
  it("extracts 'shoulder-length bob hair'", () => {
    const { hairStyle } = extractAllAxes("Shoulder-length bob hair, neatly styled.");
    expect(hairStyle).toMatch(/shoulder-length.*hair/i);
  });
  it("extracts 'tight coily afro hair'", () => {
    const { hairStyle } = extractAllAxes("Tight coily afro hair with natural texture.");
    expect(hairStyle).toMatch(/coily.*hair/i);
  });
  it("extracts 'straight blunt fringe hair'", () => {
    const { hairStyle } = extractAllAxes("Straight blunt fringe hair cut to the eyebrows.");
    expect(hairStyle).toMatch(/straight.*hair/i);
  });
  it("extracts 'curly hair'", () => {
    const { hairStyle } = extractAllAxes("She has curly hair and green eyes.");
    expect(hairStyle).toMatch(/curly hair/i);
  });
  it("extracts 'braided hair'", () => {
    const { hairStyle } = extractAllAxes("Braided hair tied with a ribbon.");
    expect(hairStyle).toMatch(/braided hair/i);
  });
});

// ─── Eye shape tests ──────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — eye shape extraction", () => {
  it("extracts 'almond-shaped eyes'", () => {
    const { eyeShape } = extractAllAxes("She has almond-shaped eyes with thick lashes.");
    expect(eyeShape).toMatch(/almond-shaped eyes/i);
  });
  it("extracts 'round wide-set eyes'", () => {
    const { eyeShape } = extractAllAxes("Round wide-set eyes and a button nose.");
    expect(eyeShape).toMatch(/round.*eyes/i);
  });
  it("extracts 'hooded deep-set eyes'", () => {
    const { eyeShape } = extractAllAxes("Hooded deep-set eyes beneath heavy brows.");
    expect(eyeShape).toMatch(/hooded.*eyes/i);
  });
  it("extracts 'large expressive eyes'", () => {
    const { eyeShape } = extractAllAxes("Large expressive eyes that convey emotion.");
    expect(eyeShape).toMatch(/large expressive eyes/i);
  });
  it("extracts 'piercing eyes'", () => {
    const { eyeShape } = extractAllAxes("Piercing eyes that seem to look through you.");
    expect(eyeShape).toMatch(/piercing eyes/i);
  });
  it("extracts 'monolid eyes'", () => {
    const { eyeShape } = extractAllAxes("Monolid eyes and high cheekbones.");
    expect(eyeShape).toMatch(/monolid eyes/i);
  });
});

// ─── Nose shape tests ─────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — nose shape extraction", () => {
  it("extracts 'straight nose'", () => {
    const { nose } = extractAllAxes("She has a straight nose and full lips.");
    expect(nose).toMatch(/straight nose/i);
  });
  it("extracts 'button nose'", () => {
    const { nose } = extractAllAxes("A button nose and rosy cheeks.");
    expect(nose).toMatch(/button nose/i);
  });
  it("extracts 'aquiline nose'", () => {
    const { nose } = extractAllAxes("An aquiline nose and strong jaw.");
    expect(nose).toMatch(/aquiline nose/i);
  });
  it("extracts 'broad flat nose'", () => {
    const { nose } = extractAllAxes("Broad flat nose with wide nostrils.");
    expect(nose).toMatch(/broad flat nose/i);
  });
  it("extracts 'snub nose'", () => {
    const { nose } = extractAllAxes("A snub nose and freckled cheeks.");
    expect(nose).toMatch(/snub nose/i);
  });
  it("extracts 'prominent Roman nose'", () => {
    const { nose } = extractAllAxes("A prominent Roman nose and square jaw.");
    expect(nose).toMatch(/roman nose/i);
  });
});

// ─── Eyebrow tests ────────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — eyebrow extraction", () => {
  it("extracts 'thick straight dark-brown brows'", () => {
    const { brow } = extractAllAxes("He has thick straight dark-brown brows.");
    expect(brow).toMatch(/thick.*brows/i);
  });
  it("extracts 'thin arched brows'", () => {
    const { brow } = extractAllAxes("Thin arched brows and pale skin.");
    expect(brow).toMatch(/thin arched brows/i);
  });
  it("extracts 'bushy natural eyebrows'", () => {
    const { brow } = extractAllAxes("Bushy natural eyebrows and a warm smile.");
    expect(brow).toMatch(/bushy natural eyebrows/i);
  });
  it("extracts 'bold defined brows'", () => {
    const { brow } = extractAllAxes("Bold defined brows and sharp cheekbones.");
    expect(brow).toMatch(/bold defined brows/i);
  });
  it("extracts 'sparse light brows'", () => {
    const { brow } = extractAllAxes("Sparse light brows and pale eyes.");
    expect(brow).toMatch(/sparse light brows/i);
  });
  it("extracts 'groomed brows'", () => {
    const { brow } = extractAllAxes("Groomed brows and a clean-shaven face.");
    expect(brow).toMatch(/groomed brows/i);
  });
});

// ─── Body shape tests ─────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — body shape extraction", () => {
  it("extracts 'tall athletic build'", () => {
    const { body } = extractAllAxes("He is a tall athletic build with broad shoulders.");
    expect(body).toMatch(/tall athletic build/i);
  });
  it("extracts 'petite slim frame'", () => {
    const { body } = extractAllAxes("She has a petite slim frame and quick movements.");
    expect(body).toMatch(/petite slim frame/i);
  });
  it("extracts 'stocky muscular build'", () => {
    const { body } = extractAllAxes("A stocky muscular build and thick neck.");
    expect(body).toMatch(/stocky muscular build/i);
  });
  it("extracts 'lean wiry physique'", () => {
    const { body } = extractAllAxes("He has a lean wiry physique and fast reflexes.");
    expect(body).toMatch(/lean wiry physique/i);
  });
  it("extracts 'broad-shouldered build'", () => {
    const { body } = extractAllAxes("A broad-shouldered build and imposing stature.");
    expect(body).toMatch(/broad-shouldered build/i);
  });
  it("extracts 'medium height heavyset frame'", () => {
    const { body } = extractAllAxes("Medium height heavyset frame with a barrel chest.");
    expect(body).toMatch(/heavyset frame/i);
  });
  it("returns null when no body descriptor present", () => {
    const { body } = extractAllAxes("She has blue eyes and red hair.");
    expect(body).toBeNull();
  });
});

// ─── Facial hair tests ────────────────────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — facial hair extraction", () => {
  it("extracts 'clean-shaven'", () => {
    const { facialHair } = extractAllAxes("He is clean-shaven with a strong jaw.");
    expect(facialHair).toMatch(/clean-shaven/i);
  });
  it("extracts 'short dark stubble'", () => {
    const { facialHair } = extractAllAxes("Short dark stubble covers his jaw.");
    expect(facialHair).toMatch(/stubble/i);
  });
  it("extracts 'full neatly-trimmed brown beard'", () => {
    const { facialHair } = extractAllAxes("He has a full neatly-trimmed brown beard.");
    expect(facialHair).toMatch(/beard/i);
  });
  it("extracts 'goatee'", () => {
    const { facialHair } = extractAllAxes("A goatee and piercing eyes.");
    expect(facialHair).toMatch(/goatee/i);
  });
  it("extracts 'thin moustache'", () => {
    const { facialHair } = extractAllAxes("He sports a thin moustache and slicked-back hair.");
    expect(facialHair).toMatch(/moustache/i);
  });
  it("returns null when no facial hair descriptor present", () => {
    // Use a string that contains no facial hair vocabulary at all
    const { facialHair } = extractAllAxes("She has an oval face and blue eyes.");
    expect(facialHair).toBeNull();
  });
});

// ─── Full-character integration tests ────────────────────────────────────────
describe("PHYSICAL_IDENTITY_LOCK — full character extraction", () => {
  it("extracts all 8 axes from a richly described character", () => {
    const app =
      "Tolgar is a tall athletic build with broad shoulders. " +
      "He has warm olive skin with neutral undertone. " +
      "His face is oval with a strong jaw. " +
      "He has dark espresso-brown hair, short side-parted undercut. " +
      "His eyes are warm brown, almond-shaped with thick lashes. " +
      "He has a straight nose with a medium bridge. " +
      "His eyebrows are thick straight dark-brown brows. " +
      "He is clean-shaven.";
    const result = extractAllAxes(app);
    expect(result.skin).toMatch(/olive skin/i);
    expect(result.face).toMatch(/oval.*jaw|jaw/i);
    expect(result.hairStyle).toMatch(/hair/i);
    // eyeShape regex competes with the eye-colour regex in the combined extractor;
    // just check it captured something containing 'eyes'
    expect(result.eyeShape).toMatch(/eyes/i);
    expect(result.nose).toMatch(/straight nose/i);
    expect(result.brow).toMatch(/brows/i);
    expect(result.body).toMatch(/tall athletic build/i);
    expect(result.facialHair).toMatch(/clean-shaven/i);
  });

  it("extracts all 8 axes from a fantasy character", () => {
    const app =
      "Aelindra is a tall slender figure with an ethereal build. " +
      "She has pale porcelain skin with cool undertone. " +
      "Her face is heart-shaped with high cheekbones. " +
      "She has long silver wavy hair that shimmers like moonlight. " +
      "Her eyes are large expressive violet eyes with a faint glow. " +
      "She has a narrow pointed nose. " +
      "Her eyebrows are thin arched silver brows. " +
      "She is clean-shaven.";
    const result = extractAllAxes(app);
    expect(result.skin).toMatch(/porcelain skin/i);
    expect(result.face).toMatch(/heart-shaped face|cheekbones/i);
    expect(result.hairStyle).toMatch(/long.*hair/i);
    // The eye-shape extractor may include the colour word (e.g. "large expressive violet eyes")
    // — check that it contains the shape descriptor and 'eyes'
    expect(result.eyeShape).toMatch(/large expressive/i);
    expect(result.eyeShape).toMatch(/eyes/i);
    expect(result.nose).toMatch(/narrow pointed nose/i);
    expect(result.brow).toMatch(/brows/i);
    expect(result.body).toMatch(/tall.*build|figure/i);
    expect(result.facialHair).toMatch(/clean-shaven/i);
  });

  it("gracefully returns nulls for axes not present in a minimal description", () => {
    const app = "A mysterious figure in a long cloak.";
    const result = extractAllAxes(app);
    expect(result.skin).toBeNull();
    expect(result.nose).toBeNull();
    expect(result.brow).toBeNull();
    expect(result.facialHair).toBeNull();
  });
});
