/**
 * ComicPageLayout
 *
 * Renders a single comic book page as a proper panel grid:
 *   ┌──────────┬──────────┐
 *   │ Panel 1  │ Panel 2  │   ← top row: two equal panels side-by-side
 *   ├──────────┴──────────┤
 *   │      Panel 3        │   ← bottom row: one wide panel spanning full width
 *   └─────────────────────┘
 *
 * Each panel shows its image, a narration caption strip at the bottom,
 * and an SVG speech bubble if dialogue was extracted for that panel.
 */

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main layout ──────────────────────────────────────────────────────────────

export function ComicPageLayout({
  panels,
  pageNumber,
  choiceSlot,
  endSlot,
  className,
}: ComicPageLayoutProps) {
  const panel1 = panels[0];
  const panel2 = panels[1];
  const panel3 = panels[2];

  return (
    <div
      className={cn(
        "bg-white text-black rounded-xl overflow-hidden shadow-2xl border-4 border-black",
        "flex flex-col",
        className,
      )}
      style={{ fontFamily: "'Bangers', 'Impact', 'Arial Black', sans-serif" }}
    >
      {/* ── Top row: two panels side by side ─────────────────────────── */}
      <div className="grid grid-cols-2 border-b-4 border-black" style={{ minHeight: "42%" }}>
        <ComicPanelCell panel={panel1} borderClass="border-r-4 border-black" />
        <ComicPanelCell panel={panel2} />
      </div>

      {/* ── Bottom row: one wide panel ───────────────────────────────── */}
      <div style={{ minHeight: "38%" }}>
        <ComicPanelCell panel={panel3} wide />
      </div>

      {/* ── Footer: page number + choices ────────────────────────────── */}
      {(pageNumber != null || choiceSlot || endSlot) && (
        <div className="border-t-4 border-black bg-[#FFFDE7] px-4 py-4 flex flex-col gap-3 min-h-fit">
          {pageNumber != null && (
            <div className="text-xs font-bold text-gray-500 text-right tracking-widest">
              — {pageNumber} —
            </div>
          )}
          {choiceSlot}
          {endSlot}
        </div>
      )}
    </div>
  );
}

// ─── Internal panel cell ──────────────────────────────────────────────────────

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
          borderClass,
        )}
      >
        <span className="text-gray-400 text-xs italic">No image</span>
      </div>
    );
  }

  const hasBubble = !!panel.dialogue;

  return (
    <div className={cn("relative overflow-hidden group", borderClass)}>
      {/* Panel image */}
      <img
        src={panel.imageUrl}
        alt="Comic panel"
        className={cn(
          "w-full object-cover block bg-black",
          wide ? "h-56 md:h-80" : "h-44 md:h-64",
        )}
        style={{ imageRendering: "auto" }}
      />

      {/* Speech bubble — positioned at the LLM-specified corner */}
      {hasBubble && (
        <SpeechBubble
          text={panel.dialogue!}
          speaker={panel.speaker ?? undefined}
          type={panel.bubbleType ?? "speech"}
          position={panel.position ?? "top-right"}
          wide={wide}
        />
      )}

      {/* Narration caption strip at the bottom of the panel */}
      {panel.narration && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-black px-2 py-1"
          style={{
            fontSize: wide ? "0.8rem" : "0.7rem",
            lineHeight: 1.3,
            letterSpacing: "0.01em",
          }}
        >
          <span className="font-bold uppercase tracking-wide">{panel.narration}</span>
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

// ─── Speech Bubble ────────────────────────────────────────────────────────────

type BubblePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface SpeechBubbleProps {
  text: string;
  speaker?: string;
  type?: "speech" | "thought" | "shout" | null;
  position?: BubblePosition;
  wide?: boolean;
}

/**
 * Renders an SVG speech bubble overlaid on a panel image.
 *
 * - "speech"  → classic rounded rectangle with a downward tail
 * - "thought" → cloud-like bubble with small circles as tail
 * - "shout"   → spiky starburst / jagged outline
 */
function SpeechBubble({ text, speaker, type = "speech", position = "top-right", wide }: SpeechBubbleProps) {
  const bubbleType = type ?? "speech";

  // Clamp text to avoid overflow
  const displayText = text.length > 60 ? text.slice(0, 57) + "…" : text;

  // Resolve corner coordinates from position
  const inset = wide ? 10 : 7;
  const posStyle: React.CSSProperties = {};
  const pos = position ?? "top-right";
  if (pos === "top-left")    { posStyle.top = inset;    posStyle.left  = inset; }
  if (pos === "top-right")   { posStyle.top = inset;    posStyle.right = inset; }
  if (pos === "bottom-left") { posStyle.bottom = wide ? 36 : 32; posStyle.left  = inset; }
  if (pos === "bottom-right"){ posStyle.bottom = wide ? 36 : 32; posStyle.right = inset; }

  // Shared container positioning — max-width scales with text length
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
        <ThoughtBubble text={displayText} speaker={speaker} wide={wide} position={pos} />
      </div>
    );
  }

  if (bubbleType === "shout") {
    return (
      <div style={containerStyle}>
        <ShoutBubble text={displayText} speaker={speaker} wide={wide} position={pos} />
      </div>
    );
  }

  // Default: speech bubble
  return (
    <div style={containerStyle}>
      <RegularSpeechBubble text={displayText} speaker={speaker} wide={wide} position={pos} />
    </div>
  );
}

// ─── Speech bubble variants ───────────────────────────────────────────────────

interface BubbleVariantProps {
  text: string;
  speaker?: string;
  wide?: boolean;
  position?: BubblePosition;
}

/**
 * Returns a font size (px) that scales inversely with text length.
 *
 * Breakpoints (narrow / wide panel):
 *   ≤ 15 chars  → 14 / 16 px  (big, punchy)
 *   ≤ 30 chars  → 12 / 14 px
 *   ≤ 45 chars  → 10.5 / 12 px
 *   ≤ 60 chars  →  9.5 / 11 px  (current default)
 *   > 60 chars  →  8.5 / 10 px  (small, fits long lines)
 */
function scaledFontSize(text: string, wide: boolean | undefined): number {
  const len = text.length;
  if (len <= 15) return wide ? 16 : 14;
  if (len <= 30) return wide ? 14 : 12;
  if (len <= 45) return wide ? 12 : 10.5;
  if (len <= 60) return wide ? 11 : 9.5;
  return wide ? 10 : 8.5;
}

/**
 * Returns a max-width percentage string that widens the bubble for longer text.
 *
 * Breakpoints (narrow / wide panel):
 *   ≤ 15 chars  → 38% / 34%  (compact — short punchy lines don't need much room)
 *   ≤ 30 chars  → 46% / 42%
 *   ≤ 45 chars  → 54% / 50%
 *   ≤ 60 chars  → 60% / 56%  (previous fixed default)
 *   > 60 chars  → 68% / 64%  (wide — long lines need room to breathe)
 */
function scaledMaxWidth(text: string, wide: boolean | undefined): string {
  const len = text.length;
  if (len <= 15) return wide ? "34%" : "38%";
  if (len <= 30) return wide ? "42%" : "46%";
  if (len <= 45) return wide ? "50%" : "54%";
  if (len <= 60) return wide ? "56%" : "60%";
  return wide ? "64%" : "68%";
}

/**
 * Returns inner padding values (px) that scale inversely with text length.
 *
 * Short punchy lines get tighter padding so the bubble hugs the text.
 * Long lines get more room so text doesn't press against the border.
 *
 * Returns { v: vertical, h: horizontal } in px.
 */
function scaledPadding(text: string, wide: boolean | undefined): { v: number; h: number } {
  const len = text.length;
  if (len <= 15) return wide ? { v: 4, h: 7 }  : { v: 3, h: 5 };
  if (len <= 30) return wide ? { v: 5, h: 8 }  : { v: 4, h: 7 };
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
 *   top-left     → tail points down-right  (bottom-right of bubble)
 *   top-right    → tail points down-left   (bottom-left of bubble)
 *   bottom-left  → tail points up-right    (top-right of bubble)
 *   bottom-right → tail points up-left     (top-left of bubble)
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
        width: 0, height: 0,
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
        width: 0, height: 0,
        borderLeft: `6px solid transparent`,
        borderRight: `6px solid transparent`,
        borderTop: `${size}px solid ${color}`,
      };
    case "bottom-left":
      return {
        position: "absolute",
        top: offset,
        right: outer ? 18 : 19 + innerOffset,
        width: 0, height: 0,
        borderLeft: `6px solid transparent`,
        borderRight: `6px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
      };
    case "bottom-right":
      return {
        position: "absolute",
        top: offset,
        left: outer ? 18 : 19 + innerOffset,
        width: 0, height: 0,
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
type DotSpec = { v: string; vVal: number; h: string; hVal: number; size: number };

function thoughtDots(pos: BubblePosition): DotSpec[] {
  // Dots trail AWAY from the bubble corner toward the character (panel center).
  switch (pos) {
    case "top-left":
      return [
        { v: "bottom", vVal: -10, h: "right", hVal: 14, size: 7 },
        { v: "bottom", vVal: -18, h: "right", hVal: 8,  size: 5 },
        { v: "bottom", vVal: -24, h: "right", hVal: 3,  size: 3 },
      ];
    case "top-right":
    default:
      return [
        { v: "bottom", vVal: -10, h: "left", hVal: 14, size: 7 },
        { v: "bottom", vVal: -18, h: "left", hVal: 8,  size: 5 },
        { v: "bottom", vVal: -24, h: "left", hVal: 3,  size: 3 },
      ];
    case "bottom-left":
      return [
        { v: "top", vVal: -10, h: "right", hVal: 14, size: 7 },
        { v: "top", vVal: -18, h: "right", hVal: 8,  size: 5 },
        { v: "top", vVal: -24, h: "right", hVal: 3,  size: 3 },
      ];
    case "bottom-right":
      return [
        { v: "top", vVal: -10, h: "left", hVal: 14, size: 7 },
        { v: "top", vVal: -18, h: "left", hVal: 8,  size: 5 },
        { v: "top", vVal: -24, h: "left", hVal: 3,  size: 3 },
      ];
  }
}

function RegularSpeechBubble({ text, speaker, wide, position = "top-right" }: BubbleVariantProps) {
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
        fontFamily: "'Bangers', 'Impact', sans-serif",
        fontSize,
        lineHeight: 1.25,
        letterSpacing: "0.03em",
        color: "#111",
        wordBreak: "break-word",
      }}
    >
      {speaker && (
        <span
          style={{
            display: "block",
            fontSize: fontSize - 1,
            color: "#555",
            fontWeight: "bold",
            marginBottom: 2,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {speaker}:
        </span>
      )}
      {text}
      {/* Outer border triangle */}
      <span style={tailProps(pos, true)} />
      {/* Inner white fill triangle */}
      <span style={tailProps(pos, false)} />
    </div>
  );
}

function ThoughtBubble({ text, speaker, wide, position = "top-right" }: BubbleVariantProps) {
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
          padding: (() => { const p = scaledPadding(text, wide); return `${p.v}px ${p.h}px`; })(),
          fontFamily: "'Bangers', 'Impact', sans-serif",
          fontSize,
          lineHeight: 1.25,
          color: "#111",
          wordBreak: "break-word",
          textAlign: "center",
          fontStyle: "italic",
        }}
      >
        {speaker && (
          <span
            style={{
              display: "block",
              fontSize: fontSize - 1,
              color: "#555",
              fontWeight: "bold",
              marginBottom: 2,
              textTransform: "uppercase",
            }}
          >
            {speaker}:
          </span>
        )}
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

function ShoutBubble({ text, speaker, wide }: BubbleVariantProps) {
  // Shout bubbles get a slight boost (+1.5) over regular for extra impact
  const fontSize = scaledFontSize(text, wide) + 1.5;
  // Spiky starburst via CSS clip-path
  return (
    <div
      style={{
        position: "relative",
        background: "#FFF176",
        border: "3px solid black",
        padding: (() => { const p = scaledPadding(text, wide); return `${p.v + 2}px ${p.h + 2}px`; })(),
        fontFamily: "'Bangers', 'Impact', sans-serif",
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
      {speaker && (
        <span
          style={{
            display: "block",
            fontSize: fontSize - 1,
            color: "#555",
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          {speaker}:
        </span>
      )}
      {text}
    </div>
  );
}
