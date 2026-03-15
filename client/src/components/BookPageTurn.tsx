import React, { ReactNode, CSSProperties } from "react";
import { Trophy, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";

/**
 * BookPageTurn Component
 * 
 * Renders a realistic book page turn animation with proper 3D layering.
 * Supports both comic and story book layouts with A/B choices.
 */

interface Page {
  id: number;
  content?: string | null;
  imageUrl?: string | null;
  choiceA?: string | null;
  choiceB?: string | null;
  nextPageIdA?: number | null;
  nextPageIdB?: number | null;
  panels?: unknown;
  [key: string]: any;
}

interface AnimationState {
  isAnimating: boolean;
  direction: "forward" | "backward" | null | undefined;
  prefersReducedMotion: boolean;
}

interface BookPageTurnProps {
  /** Current spread: left and right pages */
  currentSpread: {
    left: Page;
    right?: Page;
  };
  /** Next spread to show during animation */
  nextSpread: {
    left?: Page;
    right?: Page;
  };
  /** Page numbers for display */
  leftPageNumber: number;
  rightPageNumber: number;
  /** Animation state */
  animationState: AnimationState;
  /** Is this a comic book? */
  isComic: boolean;
  /** Whether current page has choices */
  hasChoices: boolean;
  /** Callback for choice selection */
  onChoice: (choiceIndex: number, nextPageId: number | null | undefined) => void;
  /** Is this the last page? */
  isLastPage: boolean;
  /** Was the book just completed? */
  justCompleted: boolean;
  /** Callback for restart */
  onRestart: () => void;
  /** Render function for left page */
  renderLeftPage: (page: Page | undefined, pageNum: number) => ReactNode;
  /** Render function for right page */
  renderRightPage: (page: Page | undefined, pageNum: number) => ReactNode;
  /** Additional className */
  className?: string;
}

export function BookPageTurn({
  currentSpread,
  nextSpread,
  leftPageNumber,
  rightPageNumber,
  animationState,
  isComic,
  hasChoices,
  onChoice,
  isLastPage,
  justCompleted,
  onRestart,
  renderLeftPage,
  renderRightPage,
  className = "",
}: BookPageTurnProps) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { isAnimating, direction, prefersReducedMotion } = animationState;

  // Animation keyframes for realistic page turn
  const animationStyle = `
    @keyframes pageFlipForward {
      0% {
        transform: rotateY(0deg) translateZ(0);
        opacity: 1;
        box-shadow: inset -5px 0 15px rgba(0, 0, 0, 0.05);
      }
      25% {
        box-shadow: inset -15px 0 30px rgba(0, 0, 0, 0.15);
      }
      50% {
        transform: rotateY(-90deg) translateZ(0);
        box-shadow: inset -25px 0 40px rgba(0, 0, 0, 0.25);
      }
      75% {
        box-shadow: inset -15px 0 30px rgba(0, 0, 0, 0.15);
      }
      100% {
        transform: rotateY(-180deg) translateZ(0);
        opacity: 0;
        box-shadow: inset -5px 0 15px rgba(0, 0, 0, 0.05);
      }
    }

    @keyframes pageFlipBackward {
      0% {
        transform: rotateY(0deg) translateZ(0);
        opacity: 1;
        box-shadow: inset 5px 0 15px rgba(0, 0, 0, 0.05);
      }
      25% {
        box-shadow: inset 15px 0 30px rgba(0, 0, 0, 0.15);
      }
      50% {
        transform: rotateY(90deg) translateZ(0);
        box-shadow: inset 25px 0 40px rgba(0, 0, 0, 0.25);
      }
      75% {
        box-shadow: inset 15px 0 30px rgba(0, 0, 0, 0.15);
      }
      100% {
        transform: rotateY(180deg) translateZ(0);
        opacity: 0;
        box-shadow: inset 5px 0 15px rgba(0, 0, 0, 0.05);
      }
    }
  `;

  const turningPageStyle: CSSProperties = {
    animation: !prefersReducedMotion && isAnimating && direction
      ? `${direction === "forward" ? "pageFlipForward" : "pageFlipBackward"} 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`
      : "none",
    transformOrigin: "left center", // Pivot at spine (left edge of right page)
    transformStyle: "preserve-3d",
    backfaceVisibility: "hidden",
    perspective: "1200px",
  };

  return (
    <>
      <style>{animationStyle}</style>
      
      {/* Book container with perspective */}
      <div
        className={`relative w-full ${className}`}
        style={{
          perspective: "1400px",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Current spread (base layer) */}
        <div
          className="grid grid-cols-2 gap-0 relative shadow-2xl rounded-xl overflow-hidden"
          style={{
            transformStyle: "preserve-3d",
            minHeight: "600px",
          }}
        >
          {/* Left page (fixed, never animates) */}
          <div
            className="relative h-full"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderLeftPage(currentSpread.left, leftPageNumber)}
          </div>

          {/* Right page (base, hidden behind turning page during animation) */}
          <div
            className="relative h-full"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              opacity: isAnimating ? 0 : 1,
              transition: "opacity 0.1s",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderRightPage(currentSpread.right, rightPageNumber)}
          </div>
        </div>

        {/* Turning page (animated overlay, absolute positioned) */}
        {isAnimating && direction && (
          <div
            className="absolute inset-0 grid grid-cols-2 gap-0 pointer-events-none shadow-2xl rounded-xl overflow-hidden"
            style={{
              zIndex: 10,
              minHeight: "600px",
            }}
          >
            {/* Empty left side (turning page only covers right half) */}
            <div />

            {/* Right page copy that animates */}
            <div
              className="relative h-full"
              style={{
                ...turningPageStyle,
                transformStyle: "preserve-3d",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Front face (visible) */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                {renderRightPage(currentSpread.right, rightPageNumber)}
              </div>

              {/* Back face (cream paper, shown during flip) */}
              <div
                className="absolute inset-0 bg-[#F5F0E8]"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              />
            </div>
          </div>
        )}

        {/* Next spread underlay (revealed as turning page moves) */}
        {isAnimating && direction && (
          <div
            className="absolute inset-0 grid grid-cols-2 gap-0 pointer-events-none shadow-2xl rounded-xl overflow-hidden"
            style={{
              zIndex: 5,
              opacity: isAnimating ? 1 : 0,
              transition: "opacity 0.1s",
              minHeight: "600px",
            }}
          >
            {/* Next left page */}
            <div className="relative h-full" style={{ backfaceVisibility: "hidden", display: "flex", flexDirection: "column" }}>
              {renderLeftPage(nextSpread.left, leftPageNumber + 2)}
            </div>

            {/* Next right page */}
            <div className="relative h-full" style={{ backfaceVisibility: "hidden", display: "flex", flexDirection: "column" }}>
              {renderRightPage(nextSpread.right, rightPageNumber + 2)}
            </div>
          </div>
        )}

        {/* End of book overlay */}
        {isLastPage && !hasChoices && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="text-center space-y-4">
              <div className="bg-gradient-to-r from-purple-900/60 to-amber-900/40 border border-amber-500/40 rounded-xl p-4 flex flex-col items-center gap-2">
                <Trophy className="w-8 h-8 text-[#F59E0B]" />
                <p className="text-base font-bold text-white">Adventure Complete!</p>
                {justCompleted && <span className="text-green-400 font-semibold text-sm">Completed</span>}
              </div>
              <p className="text-lg font-bold text-[#2D1B69]">— {t("reader.theEnd")} —</p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={onRestart}
                  variant="outline"
                  className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/10 text-sm"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t("reader.restart")}
                </Button>
                <button
                  onClick={() => navigate("/library")}
                  className="bg-[#2D1B69] text-white hover:bg-[#3D2B79] text-sm px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  {t("reader.backToLibrary")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
