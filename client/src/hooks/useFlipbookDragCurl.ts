/*
 * useFlipbookDragCurl
 *
 * Enhances flipbook interaction with realistic page curl animation.
 * Detects drag from bottom-right corner and shows page curl effect.
 *
 * Features:
 * - Drag from bottom-right corner (within ~100px) to turn pages
 * - Realistic 3D page curl effect with shadow and perspective
 * - Smooth transition to next page on release
 * - Fling gesture support: fast drag triggers flip even if distance is short
 * - Works with both single-page and spread modes
 * - Touch support for mobile devices
 * - Visual feedback: cursor changes and corner indicator
 */

import { useState, useCallback, useRef, useEffect } from "react";

export interface UseFlipbookDragCurlOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onFlipForward: () => void;
  onFlipBackward: () => void;
  isAnimating: boolean;
  showCover: boolean;
  hasChoices: boolean;
}

export interface UseFlipbookDragCurlReturn {
  dragProgress: number;
  isDraggingCorner: boolean;
  curlStyle: React.CSSProperties;
  cornerIndicatorStyle: React.CSSProperties;
  cornerCursorStyle: string;
}

const CORNER_ZONE_SIZE = 100;
const DRAG_THRESHOLD = 50;
const CORNER_INDICATOR_SIZE = 40;
const MIN_VELOCITY_FOR_FLING = 0.5;

export function useFlipbookDragCurl({
  containerRef,
  onFlipForward,
  onFlipBackward,
  isAnimating,
  showCover,
  hasChoices,
}: UseFlipbookDragCurlOptions): UseFlipbookDragCurlReturn {
  const [dragProgress, setDragProgress] = useState(0);
  const [isDraggingCorner, setIsDraggingCorner] = useState(false);
  const [isHoveringCorner, setIsHoveringCorner] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDragPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const isDraggingRef = useRef(false);
  const isMouseInCornerRef = useRef(false);

  const isCornerDrag = useCallback((startX: number, startY: number): boolean => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    const distFromRight = rect.right - startX;
    const distFromBottom = rect.bottom - startY;
    return distFromRight < CORNER_ZONE_SIZE && distFromBottom < CORNER_ZONE_SIZE;
  }, [containerRef]);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0 || isAnimating || showCover || hasChoices) return;
      if (!isCornerDrag(e.clientX, e.clientY)) return;

      dragStartRef.current = { x: e.clientX, y: e.clientY };
      lastDragPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      velocityRef.current = { vx: 0, vy: 0 };
      isDraggingRef.current = true;
      setIsDraggingCorner(true);
      setDragProgress(0);
      e.preventDefault();
    },
    [isAnimating, showCover, hasChoices, isCornerDrag]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isAnimating || showCover || hasChoices) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      if (!isCornerDrag(touch.clientX, touch.clientY)) return;

      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      lastDragPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      velocityRef.current = { vx: 0, vy: 0 };
      isDraggingRef.current = true;
      setIsDraggingCorner(true);
      setDragProgress(0);
      e.preventDefault();
    },
    [isAnimating, showCover, hasChoices, isCornerDrag]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current || !lastDragPosRef.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const progress = Math.min(distance / DRAG_THRESHOLD, 1);

      const timeDelta = Date.now() - lastDragPosRef.current.time;
      if (timeDelta > 0) {
        velocityRef.current.vx = (touch.clientX - lastDragPosRef.current.x) / timeDelta;
        velocityRef.current.vy = (touch.clientY - lastDragPosRef.current.y) / timeDelta;
      }
      lastDragPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

      setDragProgress(progress);
      e.preventDefault();
    },
    []
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = Math.sqrt(velocityRef.current.vx ** 2 + velocityRef.current.vy ** 2);

      isDraggingRef.current = false;
      setIsDraggingCorner(false);
      dragStartRef.current = null;
      lastDragPosRef.current = null;

      if (distance >= DRAG_THRESHOLD || velocity >= MIN_VELOCITY_FOR_FLING) {
        if (dx < -Math.abs(dy) * 0.5) {
          onFlipForward();
        } else if (dx > Math.abs(dy) * 0.5) {
          onFlipBackward();
        } else {
          onFlipForward();
        }
      }

      setDragProgress(0);
      e.preventDefault();
    },
    [onFlipForward, onFlipBackward]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingRef.current && dragStartRef.current && lastDragPosRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const progress = Math.min(distance / DRAG_THRESHOLD, 1);

        const timeDelta = Date.now() - lastDragPosRef.current.time;
        if (timeDelta > 0) {
          velocityRef.current.vx = (e.clientX - lastDragPosRef.current.x) / timeDelta;
          velocityRef.current.vy = (e.clientY - lastDragPosRef.current.y) / timeDelta;
        }
        lastDragPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

        setDragProgress(progress);
        return;
      }

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const distFromRight = rect.right - e.clientX;
      const distFromBottom = rect.bottom - e.clientY;
      const inCorner = distFromRight < CORNER_ZONE_SIZE && distFromBottom < CORNER_ZONE_SIZE;

      if (inCorner !== isMouseInCornerRef.current) {
        isMouseInCornerRef.current = inCorner;
        setIsHoveringCorner(inCorner);
      }
    },
    [containerRef]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = Math.sqrt(velocityRef.current.vx ** 2 + velocityRef.current.vy ** 2);

      isDraggingRef.current = false;
      setIsDraggingCorner(false);
      dragStartRef.current = null;
      lastDragPosRef.current = null;

      if (distance >= DRAG_THRESHOLD || velocity >= MIN_VELOCITY_FOR_FLING) {
        if (dx < -Math.abs(dy) * 0.5) {
          onFlipForward();
        } else if (dx > Math.abs(dy) * 0.5) {
          onFlipBackward();
        } else {
          onFlipForward();
        }
      }

      setDragProgress(0);
    },
    [onFlipForward, onFlipBackward]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const curlStyle: React.CSSProperties = isDraggingCorner
    ? {
        perspective: "1200px",
        transformStyle: "preserve-3d",
        transform: `
          perspective(1200px)
          rotateY(${-45 * dragProgress}deg)
          rotateX(${5 * dragProgress}deg)
          skewY(${-3 * dragProgress}deg)
          scaleX(${1 - 0.05 * dragProgress})
        `,
        transition: isDraggingCorner ? "none" : "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transformOrigin: "right center",
        boxShadow: `
          inset ${-20 * dragProgress}px 0 20px rgba(0, 0, 0, ${0.3 * dragProgress}),
          ${20 * dragProgress}px 0 30px rgba(0, 0, 0, ${0.2 * dragProgress})
        `,
        filter: `brightness(${1 - 0.1 * dragProgress})`,
      }
    : {};

  const cornerIndicatorStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: `${CORNER_INDICATOR_SIZE}px`,
    height: `${CORNER_INDICATOR_SIZE}px`,
    opacity: isHoveringCorner || isDraggingCorner ? 0.6 : 0.2,
    transition: "opacity 0.2s ease-out",
    pointerEvents: "none",
    background: `radial-gradient(circle at top-left, rgba(124, 58, 237, 0.4), transparent)`,
    borderRadius: "50% 0 0 0",
  };

  const cornerCursorStyle = isDraggingCorner
    ? "grabbing"
    : isHoveringCorner
    ? "grab"
    : "default";

  return {
    dragProgress,
    isDraggingCorner,
    curlStyle,
    cornerIndicatorStyle,
    cornerCursorStyle,
  };
}
