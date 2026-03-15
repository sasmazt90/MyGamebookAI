/**
 * coverOverlay.ts
 *
 * Adds title + author name as a text overlay onto a cover image using sharp.
 * Returns a Buffer with the composited PNG.
 */
import sharp from "sharp";

interface OverlayOptions {
  imageBuffer: Buffer;
  title: string;
  authorName: string;
}

/**
 * Escape XML special characters for SVG text nodes.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap text into lines of at most `maxChars` characters.
 */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

export async function addCoverOverlay({
  imageBuffer,
  title,
  authorName,
}: OverlayOptions): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 1200;

  // --- Title text (large, bold) ---
  const titleFontSize = Math.round(w * 0.065); // ~52px at 800px wide
  const authorFontSize = Math.round(w * 0.038); // ~30px
  const maxCharsTitle = Math.floor(w / (titleFontSize * 0.55));
  const titleLines = wrapText(escapeXml(title), maxCharsTitle);
  const lineHeight = titleFontSize * 1.3;
  const titleBlockHeight = titleLines.length * lineHeight;

  // Overlay sits at the bottom 35% of the image
  const overlayH = Math.round(h * 0.35);
  const overlayY = h - overlayH;

  // Build SVG title lines
  const titleSvgLines = titleLines
    .map((line, i) => {
      const y = titleFontSize + i * lineHeight;
      return `<text
        x="${w / 2}"
        y="${y}"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="${titleFontSize}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        filter="url(#shadow)"
      >${line}</text>`;
    })
    .join("\n");

  // Author line
  const authorY = titleFontSize + titleBlockHeight + authorFontSize * 1.6;
  const authorSvg = `<text
    x="${w / 2}"
    y="${authorY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${authorFontSize}"
    font-style="italic"
    fill="#F5D78E"
    text-anchor="middle"
    filter="url(#shadow)"
  >by ${escapeXml(authorName)}</text>`;

  const svgH = Math.round(authorY + authorFontSize * 0.5);

  const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${svgH}">
    <defs>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.9"/>
      </filter>
    </defs>
    ${titleSvgLines}
    ${authorSvg}
  </svg>`;

  // Gradient overlay so text is always readable
  const gradientSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${overlayH}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="40%" stop-color="black" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${overlayH}" fill="url(#grad)"/>
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([
      // Gradient at bottom
      {
        input: Buffer.from(gradientSvg),
        top: overlayY,
        left: 0,
      },
      // Text overlay: position it so the bottom of the text block is near the bottom of the image
      {
        input: Buffer.from(svgOverlay),
        top: Math.max(0, h - svgH - Math.round(h * 0.04)),
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result;
}
