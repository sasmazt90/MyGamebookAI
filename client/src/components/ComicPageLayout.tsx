/**
 * ComicPageLayout
 *
 * Renders a single comic book page as a proper panel grid:
 *   ââââââââââââ¬âââââââââââ
 *   â Panel 1  â Panel 2  â   â top row: two equal panels side-by-side
 *   ââââââââââââ´âââââââââââ¤
 *   â      Panel 3        â   â bottom row: one wide panel spanning full width
 *   âââââââââââââââââââââââ
 *
 * Each panel shows its image, a narration caption strip at the bottom,
 * and an SVG speech bubble if dialogue was extracted for that panel.
 */

import { getComicTextFontStack } from "@/lib/comicTypography";
import { cn } from "@/lib/utils";

// âââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface ComicPanel {
  imageUrl: string;
  narration: string;
  dialogue?: string | null;
  speaker?: string | null;
  bubbleType?: "speech" | "thought" | "shout" | null;
  /** Corner where the bubble should appear, as chosen by the LLM based on character position */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
}

interface ComicPageLayoutProps {
  panels: ComicPanel[];
  /** Optional: page number shown in the corner */
  pageNumber?: number;
  /** Optional: A/B choice buttons rendered below the grid */
  choiceSlot?: React.ReactNode;
  /** Optional: end-of-book slot */
  endSlot?: React.ReactNode;
  className?: string;
}

// âââ Main layout ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export function ComicPageLayout({
  panels,
  pageNumber,
  choiceSlot,
  endSlot,
  className,
}: ComicPageLayoutProps) {
  const topPanel = panels[0];
  const bottomLeftPanel = panels[1];
  const bottomRightPanel = panels[2];
  const pageFontFamily = getComicTextFontStack(
    ...panels.flatMap(panel => [panel?.narration, panel?.dialogue])
  );

  return (
    <div
      className={cn(
        "bg-white text-black rounded-xl overflow-hidden shadow-2xl border-4 border-black",
        "flex flex-col",
        className
      )}
      style={{ fontFamily: pageFontFamily }}
    >
      {/* Top hero panel */}
      <div className="border-b-4 border-black" style={{ minHeight: "42%" }}>
        <ComicPanelCell panel={topPanel} wide />
      </div>

      {/* Bottom row: two supporting panels */}
      <div className="grid grid-cols-2" style={{ minHeight: "38%" }}>
        <ComicPanelCell
          panel={bottomLeftPanel}
          borderClass="border-r-4 border-black"
        />
        <ComicPanelCell panel={bottomRightPanel} />
      </div>

      {/* ââ Footer: page number + choices ââââââââââââââââââââââââââââââ */}
      {(pageNumber != null || choiceSlot || endSlot) && (
        <div className="border-t-4 border-black bg-[#FFFDE7] px-4 py-4 flex flex-col gap-3 min-h-fit">
          {pageNumber != null && (
            <div className="text-xs font-bold text-gray-500 text-right tracking-widest">
              Page {pageNumber}
            </div>
          )}
          {choiceSlot}
          {endSlot}
        </div>
      )}
    </div>
  );
}

// âââ Internal panel cell ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

interface ComicPanelCellProps {
  panel?: ComicPanel;
  borderClass?: string;
  wide?: boolean;
}

function ComicPanelCell({ panel, borderClass, wide }: ComicPanelCellProps) {
  if (!panel) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center bg-gray-100",
          wide ? "h-48 md:h-64" : "h-40 md:h-52",
          borderClass
        )}
      >
        <span className="text-gray-400 text-xs italic">No image</span>
      </div>
    );
  }

  const hasBubble = !!panel.dialogue;
  const panelFontFamily = getComicTextFontStack(
    panel.narration,
    panel.dialogue
  );

  return (
    <div className={cn("relative overflow-hidden group", borderClass)}>
      {/* Panel image */}
      <img
        src={panel.imageUrl}
        alt="Comic panel"
        className={cn(
          "w-full object-cover block bg-white",
          wide ? "h-56 md:h-80" : "h-44 md:h-64"
        )}
        style={{ imageRendering: "auto" }}
      />

      {/* Speech bubble â positioned at the LLM-specified corner */}
      {hasBubble && (
        <SpeechBubble
          text={panel.dialogue!}
          speaker={panel.speaker ?? undefined}
          type={panel.bubbleType ?? "speech"}
          position={(() => {
            const raw = panel.position ?? "top-right";
            if (
              panel.narration &&
              (raw === "bottom-left" || raw === "bottom-right")
            ) {
              return raw.replace("bottom-", "top-") as typeof raw;
            }
            return raw;
          })()}
          hasCaption={!!panel.narration}
          wide={wide}
          fontFamily={panelFontFamily}
        />
      )}

      {/* Narration caption strip at the bottom of the panel */}
      {panel.narration && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-black px-2 py-1"
          style={{
            fontSize: wide ? "0.75rem" : "0.65rem",
            lineHeight: 1.35,
            letterSpacing: "0.01em",
            maxHeight: wide ? "4.5rem" : "3.8rem",
            overflow: "hidden",
            fontFamily: panelFontFamily,
          }}
        >
          <span
            className="font-bold tracking-wide"
            style={
              {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              } as React.CSSProperties
            }
          >
            {panel.narration}
          </span>
        </div>
      )}

      {/* Ink-border vignette overlay for comic feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}

// âââ Speech Bubble ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

type BubblePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Removes a leading "Name: " speaker prefix the LLM sometimes injects into
 * dialogue strings (e.g. "Alex: Let's go!" → "Let's go!").
 * Matches up to 30 word-chars (incl. Turkish letters, spaces, hyphens) + colon.
 */
const SPEAKER_PREFIX_RE = /^[\p{L}\p{N}_ -]{1,30}:\s*/u;
function stripSpeakerPrefix(s: string): string {
  return s.replace(SPEAKER_PREFIX_RE, "");
}

interface SpeechBubbleProps {
  text: string;
  speaker?: string;
  type?: "speech" | "thought" | "shout" | null;
  position?: BubblePosition;
  wide?: boolean;
  fontFamily?: string;
  /** True when a narration caption strip is rendered at the bottom of the panel */
  hasCaption?: boolean;
}

/**
 * Renders an SVG speech bubble overlaid on a panel image.
 *
 * - "speech"  â classic rounded rectangle with a downward tail
 * - "thought" â cloud-like bubble with small circles as tail
 * - "shout"   â spiky starburst / jagged outline
 */
function SpeechBubble({
  text,
  speaker,
  type = "speech",
  position = "top-right",
  wide,
  hasCaption,
  fontFamily,
}: SpeechBubbleProps) {
  const bubbleType = type ?? "speech";

  // Strip leading "Name: " prefix the LLM may bake into dialogue, then clamp
  const cleanText = stripSpeakerPrefix(text.trim());
  const displayText =
    cleanText.length > 90 ? cleanText.slice(0, 87) + "â¦" : cleanText;

  // Resolve corner coordinates from position
  const inset = wide ? 10 : 7;
  const posStyle: React.CSSProperties = {};
  const pos = position ?? "top-right";
  // Extra clearance when a narration caption strip sits at the bottom of the panel
  // (caption ~28-36px tall + 8px gap = safe bottom offset)
  const captionClearance = hasCaption ? (wide ? 52 : 44) : wide ? 36 : 32;
  if (pos === "top-left") {
    posStyle.top = inset;
    posStyle.left = inset;
  }
  if (pos === "top-right") {
    posStyle.top = inset;
    posStyle.right = inset;
  }
  if (pos === "bottom-left") {
    posStyle.bottom = captionClearance;
    posStyle.left = inset;
  }
  if (pos === "bottom-right") {
    posStyle.bottom = captionClearance;
    posStyle.right = inset;
  }

  // Shared container positioning â max-width scales with text length
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    maxWidth: scaledMaxWidth(displayText, wide),
    zIndex: 10,
    pointerEvents: "none",
    filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.45))",
    ...posStyle,
  };

  if (bubbleType === "thought") {
    return (
      <div style={containerStyle}>
        <ThoughtBubble
          text={displayText}
          speaker={speaker}
          wide={wide}
          position={pos}
          fontFamily={fontFamily}
        />
      </div>
    );
  }

  if (bubbleType === "shout") {
    return (
      <div style={containerStyle}>
        <ShoutBubble
          text={displayText}
          speaker={speaker}
          wide={wide}
          position={pos}
          fontFamily={fontFamily}
        />
      </div>
    );
  }

  // Default: speech bubble
  return (
    <div style={containerStyle}>
      <RegularSpeechBubble
        text={displayText}
        speaker={speaker}
        wide={wide}
        position={pos}
        fontFamily={fontFamily}
      />
    </div>
  );
}

// âââ Speech bubble variants âââââââââââââââââââââââââââââââââââââââââââââââââââ

interface BubbleVariantProps {
  text: string;
  speaker?: string;
  wide?: boolean;
  position?: BubblePosition;
  fontFamily?: string;
}

/**
 * Returns a font size (px) that scales inversely with text length.
 *
 * Breakpoints (narrow / wide panel):
 *   â¤ 15 chars  â 14 / 16 px  (big, punchy)
 *   â¤ 30 chars  â 12 / 14 px
 *   â¤ 45 chars  â 10.5 / 12 px
 *   â¤ 60 chars  â  9.5 / 11 px  (current default)
 *   > 60 chars  â  8.5 / 10 px  (small, fits long lines)
 */
function scaledFontSize(text: string, wide: boolean | undefined): number {
  const len = text.length;
  if (len <= 15) return wide ? 16 : 14;
  if (len <= 30) return wide ? 14 : 12;
  if (len <= 45) return wide ? 12 : 10.5;
  if (len <= 60) return wide ? 11 : 9.5;
  if (len <= 75) return wide ? 9.5 : 8.5;
  return wide ? 8.5 : 7.5;
}

/**
 * Returns a max-width percentage string that widens the bubble for longer text.
 *
 * Breakpoints (narrow / wide panel):
 *   â¤ 15 chars  â 38% / 34%  (compact â short punchy lines don't need much room)
 *   â¤ 30 chars  â 46% / 42%
 *   â¤ 45 chars  â 54% / 50%
 *   â¤ 60 chars  â 60% / 56%  (previous fixed default)
 *   > 60 chars  â 68% / 64%  (wide â long lines need room to breathe)
 */
function scaledMaxWidth(text: string, wide: boolean | undefined): string {
  const len = text.length;
  if (len <= 15) return wide ? "24%" : "28%";
  if (len <= 30) return wide ? "32%" : "36%";
  if (len <= 45) return wide ? "40%" : "44%";
  if (len <= 60) return wide ? "46%" : "50%";
  if (len <= 75) return wide ? "58%" : "62%";
  return wide ? "68%" : "72%";
}

/**
 * Returns inner padding values (px) that scale inversely with text length.
 *
 * Short punchy lines get tighter padding so the bubble hugs the text.
 * Long lines get more room so text doesn't press against the border.
 *
 * Returns { v: vertical, h: horizontal } in px.
 */
function scaledPadding(
  text: string,
  wide: boolean | undefined
): { v: number; h: number } {
  const len = text.length;
  if (len <= 15) return wide ? { v: 4, h: 7 } : { v: 3, h: 5 };
  if (len <= 30) return wide ? { v: 5, h: 8 } : { v: 4, h: 7 };
  if (len <= 45) return wide ? { v: 6, h: 10 } : { v: 5, h: 8 };
  if (len <= 60) return wide ? { v: 7, h: 11 } : { v: 6, h: 9 };
  return wide ? { v: 8, h: 12 } : { v: 7, h: 10 };
}

/**
 * Returns CSS border-triangle props so the tail points TOWARD the character corner.
 *
 * The bubble is placed AT the character corner, so the tail must point INWARD
 * (toward the center of the panel, i.e. away from the bubble's own corner).
 *
 * Corner layout:
 *   top-left     â tail points down-right  (bottom-right of bubble)
 *   top-right    â tail points down-left   (bottom-left of bubble)
 *   bottom-left  â tail points up-right    (top-right of bubble)
 *   bottom-right â tail points up-left     (top-left of bubble)
 */
function tailProps(pos: BubblePosition, outer: boolean): React.CSSProperties {
  const size = outer ? 10 : 9;
  const offset = outer ? -10 : -7;
  const innerOffset = outer ? 0 : 1;
  const color = outer ? "black" : "white";

  switch (pos) {
    case "top-left":
      return {
        position: "absolute",
        bottom: offset,
        right: outer ? 18 : 19 + innerOffset,
        width: 0,
        height: 0,
        borderLeft: `6px solid transparent`,
        borderRight: `6px solid transparent`,
        borderTop: `${size}px solid ${color}`,
      };
    case "top-right":
    default:
      return {
        position: "absolute",
        bottom: offset,
        left: outer ? 18 : 19 + innerOffset,
        width: 0,
        height: 0,
        borderLeft: `6px solid transparent`,
        borderRight: `6px solid transparent`,
        borderTop: `${size}px solid ${color}`,
      };
    case "bottom-left":
      return {
        position: "absolute",
        top: offset,
        right: outer ? 18 : 19 + innerOffset,
        width: 0,
        height: 0,
        borderLeft: `6px solid transparent`,
        borderRight: `6px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
      };
    case "bottom-right":
      return {
        position: "absolute",
        top: offset,
        left: outer ? 18 : 19 + innerOffset,
        width: 0,
        height: 0,
        borderLeft: `6px solid transparent`,
        borderRight: `6px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
      };
  }
}

/**
 * Returns the three trailing dot positions for thought bubbles,
 * pointing toward the character corner.
 */
type DotSpec = {
  v: string;
  vVal: number;
  h: string;
  hVal: number;
  size: number;
};

function thoughtDots(pos: BubblePosition): DotSpec[] {
  // Dots trail AWAY from the bubble corner toward the character (panel center).
  switch (pos) {
    case "top-left":
      return [
        { v: "bottom", vVal: -10, h: "right", hVal: 14, size: 7 },
        { v: "bottom", vVal: -18, h: "right", hVal: 8, size: 5 },
        { v: "bottom", vVal: -24, h: "right", hVal: 3, size: 3 },
      ];
    case "top-right":
    default:
      return [
        { v: "bottom", vVal: -10, h: "left", hVal: 14, size: 7 },
        { v: "bottom", vVal: -18, h: "left", hVal: 8, size: 5 },
        { v: "bottom", vVal: -24, h: "left", hVal: 3, size: 3 },
      ];
    case "bottom-left":
      return [
        { v: "top", vVal: -10, h: "right", hVal: 14, size: 7 },
        { v: "top", vVal: -18, h: "right", hVal: 8, size: 5 },
        { v: "top", vVal: -24, h: "right", hVal: 3, size: 3 },
      ];
    case "bottom-right":
      return [
        { v: "top", vVal: -10, h: "left", hVal: 14, size: 7 },
        { v: "top", vVal: -18, h: "left", hVal: 8, size: 5 },
        { v: "top", vVal: -24, h: "left", hVal: 3, size: 3 },
      ];
  }
}

function RegularSpeechBubble({
  text,
  speaker,
  wide,
  position = "top-right",
  fontFamily,
}: BubbleVariantProps) {
  const fontSize = scaledFontSize(text, wide);
  const pos = position ?? "top-right";
  // Extra bottom padding only when tail is at the bottom
  const isBottom = pos === "bottom-left" || pos === "bottom-right";
  const pad = scaledPadding(text, wide);
  // When tail is at the bottom, add extra bottom padding to clear it;
  // when tail is at the top, add extra top padding instead.
  const tailClearance = wide ? 14 : 12;
  return (
    <div
      style={{
        background: "white",
        border: "2.5px solid black",
        borderRadius: "14px",
        padding: `${pad.v}px ${pad.h}px`,
        paddingBottom: !isBottom ? tailClearance : pad.v,
        paddingTop: isBottom ? tailClearance : pad.v,
        position: "relative",
        fontFamily: fontFamily ?? getComicTextFontStack(text),
        fontSize,
        lineHeight: 1.25,
        letterSpacing: "0.03em",
        color: "#111",
        wordBreak: "break-word",
      }}
    >
      {text}
      {/* Outer border triangle */}
      <span style={tailProps(pos, true)} />
      {/* Inner white fill triangle */}
      <span style={tailProps(pos, false)} />
    </div>
  );
}

function ThoughtBubble({
  text,
  speaker,
  wide,
  position = "top-right",
  fontFamily,
}: BubbleVariantProps) {
  const fontSize = scaledFontSize(text, wide);
  const pos = position ?? "top-right";
  const dots = thoughtDots(pos);
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          background: "white",
          border: "2.5px solid black",
          borderRadius: "50%",
          padding: (() => {
            const p = scaledPadding(text, wide);
            return `${p.v}px ${p.h}px`;
          })(),
          fontFamily: fontFamily ?? getComicTextFontStack(text),
          fontSize,
          lineHeight: 1.25,
          color: "#111",
          wordBreak: "break-word",
          textAlign: "center",
          fontStyle: "italic",
        }}
      >
        {text}
      </div>
      {/* Thought circles trailing toward the character */}
      {dots.map((c, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            [c.v]: c.vVal,
            [c.h]: c.hVal,
            width: c.size,
            height: c.size,
            borderRadius: "50%",
            background: "white",
            border: "2px solid black",
          }}
        />
      ))}
    </div>
  );
}

function ShoutBubble({ text, speaker, wide, fontFamily }: BubbleVariantProps) {
  // Shout bubbles get a slight boost (+1.5) over regular for extra impact
  const fontSize = scaledFontSize(text, wide) + 1.5;
  // Spiky starburst via CSS clip-path
  return (
    <div
      style={{
        position: "relative",
        background: "#FFF176",
        border: "3px solid black",
        padding: (() => {
          const p = scaledPadding(text, wide);
          return `${p.v + 2}px ${p.h + 2}px`;
        })(),
        fontFamily: fontFamily ?? getComicTextFontStack(text),
        fontSize,
        lineHeight: 1.2,
        color: "#111",
        wordBreak: "break-word",
        textAlign: "center",
        fontWeight: "bold",
        letterSpacing: "0.04em",
        // Jagged starburst shape using clip-path
        clipPath:
          "polygon(50% 0%,61% 15%,79% 9%,72% 26%,93% 28%,80% 42%,100% 50%,80% 58%,93% 72%,72% 74%,79% 91%,61% 85%,50% 100%,39% 85%,21% 91%,28% 74%,7% 72%,20% 58%,0% 50%,20% 42%,7% 28%,28% 26%,21% 9%,39% 15%)",
        minWidth: wide ? 80 : 64,
        minHeight: wide ? 64 : 52,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {text}
    </div>
  );
}
