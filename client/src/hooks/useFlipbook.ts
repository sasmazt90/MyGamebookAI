/**
 * useFlipbook
 *
 * Manages page-turn state and all input methods for the Reader:
 *  - CSS 3D flip animation (left-to-right / right-to-left)
 *  - Touch swipe (mobile/tablet)
 *  - Mouse drag swipe (desktop)
 *  - Keyboard Left/Right Arrow
 *  - Clickable edge-zone helpers
 *  - Branch-gate: forward flip blocked until A/B choice made
 *  - Reduced-motion: respects prefers-reduced-motion OS setting
 *  - Preloads adjacent page images
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { resolveExplicitForwardPageId } from "@shared/readerFlow";

export type FlipDirection = "forward" | "backward" | null;

export interface FlipbookPage {
  id: number;
  imageUrl?: string | null;
  panels?: Array<{ imageUrl: string }> | null;
  branchPath?: string | null;
  routePageNumber?: number | null;
  nextPageIdA?: number | null;
  choiceA?: string | null;
  choiceB?: string | null;
  nextPageIdB?: number | null;
  sfxTags?: string[] | null;
  content?: string | null;
}

export interface UseFlipbookOptions {
  pages: FlipbookPage[];
  /** Current spread index (0-based, steps by 2 for two-page spreads) */
  currentPageIndex: number;
  onGoTo: (index: number, direction: FlipDirection) => void;
  /** Whether the current page has unresolved A/B choices (blocks forward flip) */
  hasChoices: boolean;
  /** Whether we are on the cover (blocks all navigation) */
  showCover: boolean;
  /** Called when user swipes/drags/keys backward past page 0 (return to cover) */
  onReturnToCover: () => void;
  /** Called when user swipes/drags/keys forward past last page */
  onEnd?: () => void;
  /** Step size: 1 for comic single-page, 2 for two-page spread */
  step?: number;
  /** Whether forward navigation should honor explicit nextPageIdA links instead of stepping */
  useExplicitNextPageId?: boolean;
}

export interface UseFlipbookReturn {
  /** Direction of the in-progress flip animation */
  flipDirection: FlipDirection;
  /** Whether a flip animation is currently playing */
  isAnimating: boolean;
  /** Trigger a forward flip programmatically */
  flipForward: () => void;
  /** Trigger a backward flip programmatically */
  flipBackward: () => void;
  /** Attach to the page container for swipe/drag detection */
  containerProps: React.HTMLAttributes<HTMLDivElement>;
  /** Whether the OS prefers reduced motion */
  prefersReducedMotion: boolean;
}

const SWIPE_THRESHOLD  = 48;   // px minimum touch drag to trigger a flip
const DRAG_THRESHOLD   = 36;   // px minimum mouse drag to trigger a flip
const WHEEL_THRESHOLD  = 40;   // px minimum trackpad horizontal delta
const WHEEL_DEBOUNCE   = 400;  // ms — ignore wheel events after a flip fires
const ANIM_DURATION    = 380;  // ms — matches CSS transition

function preloadImage(url: string | null | undefined) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

export function useFlipbook({
  pages,
  currentPageIndex,
  onGoTo,
  hasChoices,
  showCover,
  onReturnToCover,
  onEnd,
  step = 2,
  useExplicitNextPageId = true,
}: UseFlipbookOptions): UseFlipbookReturn {
  const [flipDirection, setFlipDirection] = useState<FlipDirection>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Detect OS reduced-motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Preload adjacent pages whenever currentPageIndex changes
  useEffect(() => {
    const explicitNextPageId = useExplicitNextPageId
      ? resolveExplicitForwardPageId(pages, currentPageIndex, step)
      : null;
    const nextGraphIndex = explicitNextPageId != null
      ? pages.findIndex(page => page.id === explicitNextPageId)
      : currentPageIndex + step;
    const prevPage = pages[currentPageIndex - step];
    const nextPage = nextGraphIndex >= 0 ? pages[nextGraphIndex] : pages[currentPageIndex + step];
    const nextNextPage = nextGraphIndex >= 0 ? pages[nextGraphIndex + 1] : pages[currentPageIndex + step + 1];

    preloadImage(prevPage?.imageUrl);
    preloadImage(nextPage?.imageUrl);
    preloadImage(nextNextPage?.imageUrl);

    // Also preload panel images for comics
    prevPage?.panels?.forEach(p => preloadImage(p.imageUrl));
    nextPage?.panels?.forEach(p => preloadImage(p.imageUrl));
  }, [currentPageIndex, pages, step, useExplicitNextPageId]);

  // ── Core navigation logic ────────────────────────────────────────────────

  // Sync ref so wheel/touch callbacks don't capture stale isAnimating state
  const animatingRef = useRef(false);

  const animate = useCallback((dir: FlipDirection, action: () => void) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setFlipDirection(dir);
    setIsAnimating(true);
    const duration = prefersReducedMotion ? 0 : ANIM_DURATION;
    setTimeout(() => {
      action();
      setFlipDirection(null);
      setIsAnimating(false);
      animatingRef.current = false;
    }, duration);
  }, [prefersReducedMotion]);

  const flipForward = useCallback(() => {
    if (showCover || animatingRef.current) return;
    if (hasChoices) return; // branch-gate: must choose A or B first

    const currentPage = pages[currentPageIndex];
    const explicitNextPageId = useExplicitNextPageId
      ? resolveExplicitForwardPageId(pages, currentPageIndex, step)
      : null;
    const isTerminalPage =
      !!currentPage &&
      !currentPage.choiceA &&
      !currentPage.choiceB &&
      !currentPage.nextPageIdA &&
      !currentPage.nextPageIdB;
    if (isTerminalPage) {
      onEnd?.();
      return;
    }

    if (explicitNextPageId != null) {
      const explicitIndex = pages.findIndex((page) => page.id === explicitNextPageId);
      if (explicitIndex >= 0) {
        animate("forward", () => onGoTo(explicitIndex, "forward"));
        return;
      }
    }

    const nextIndex = currentPageIndex + step;
    if (nextIndex >= pages.length) {
      onEnd?.();
      return;
    }
    animate("forward", () => onGoTo(nextIndex, "forward"));
  }, [showCover, hasChoices, currentPageIndex, step, pages, animate, onGoTo, onEnd, useExplicitNextPageId]);

  const flipBackward = useCallback(() => {
    if (showCover || animatingRef.current) return;

    if (currentPageIndex === 0) {
      animate("backward", () => onReturnToCover());
      return;
    }
    const prevIndex = Math.max(0, currentPageIndex - step);
    animate("backward", () => onGoTo(prevIndex, "backward"));
  }, [showCover, currentPageIndex, step, animate, onGoTo, onReturnToCover]);

  // ── Touch swipe ─────────────────────────────────────────────────────────

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Ignore if predominantly vertical (scroll)
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    if (dx < 0) flipForward();
    else flipBackward();
  }, [flipForward, flipBackward]);

  // ── Mouse drag swipe ─────────────────────────────────────────────────────

  const mouseStartX = useRef<number | null>(null);
  const isDragging  = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left button
    if (e.button !== 0) return;
    mouseStartX.current = e.clientX;
    isDragging.current = true;
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || mouseStartX.current === null) return;
    isDragging.current = false;
    const dx = e.clientX - mouseStartX.current;
    mouseStartX.current = null;

    if (Math.abs(dx) < DRAG_THRESHOLD) return;
    if (dx < 0) flipForward();
    else flipBackward();
  }, [flipForward, flipBackward]);

  const onMouseLeave = useCallback(() => {
    isDragging.current = false;
    mouseStartX.current = null;
  }, []);

  // ── Trackpad / horizontal wheel ──────────────────────────────────────────
  // WheelEvent.deltaX fires for trackpad two-finger horizontal swipes.
  // We accumulate delta and fire once per gesture (debounced).

  const wheelAccum    = useRef(0);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelFlip = useRef(0); // timestamp of last flip triggered by wheel

  const onWheel = useCallback((e: React.WheelEvent) => {
    // Only handle horizontal scrolling (trackpad two-finger swipe)
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) return;
    if (Math.abs(e.deltaX) < 2) return;

    e.preventDefault(); // prevent horizontal page scroll

    const now = Date.now();
    if (now - lastWheelFlip.current < WHEEL_DEBOUNCE) return;

    wheelAccum.current += e.deltaX;

    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = setTimeout(() => {
      const accum = wheelAccum.current;
      wheelAccum.current = 0;
      if (Math.abs(accum) < WHEEL_THRESHOLD) return;
      lastWheelFlip.current = Date.now();
      if (accum > 0) flipForward();
      else flipBackward();
    }, 50);
  }, [flipForward, flipBackward]);

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside an input/button/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;

      if (e.key === "ArrowRight") { e.preventDefault(); flipForward(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); flipBackward(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipForward, flipBackward]);

  // ── Container props ──────────────────────────────────────────────────────

  const containerProps: React.HTMLAttributes<HTMLDivElement> = {
    onTouchStart,
    onTouchEnd,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onWheel,
    style: { userSelect: "none" },
  };

  return {
    flipDirection,
    isAnimating,
    flipForward,
    flipBackward,
    containerProps,
    prefersReducedMotion,
  };
}
