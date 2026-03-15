import React, { ReactNode, CSSProperties } from "react";
import { Trophy, RotateCcw, Home, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";

/**
 * SinglePageTransition Component
 * 
 * Used for Illustrated Fairy Tale books and Story books (single page mode).
 * Provides smooth horizontal slide transition instead of book page turn.
 */

interface SinglePageTransitionProps {
  /** Current page data */
  page: any;
  /** Page number for display */
  pageNumber: number;
  /** Whether animation is playing */
  isAnimating: boolean;
  /** Direction: "forward" (next) or "backward" (prev) or null */
  direction: "forward" | "backward" | null | undefined;
  /** User prefers reduced motion */
  prefersReducedMotion: boolean;
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
  /** Book title for display */
  bookTitle: string;
  /** Additional className */
  className?: string;
}

export function SinglePageTransition({
  page,
  pageNumber,
  isAnimating,
  direction,
  prefersReducedMotion,
  hasChoices,
  onChoice,
  isLastPage,
  justCompleted,
  onRestart,
  bookTitle,
  className = "",
}: SinglePageTransitionProps) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const animationStyle = `
    @keyframes slideInFromRight {
      0% {
        transform: translateX(100%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutToLeft {
      0% {
        transform: translateX(0);
        opacity: 1;
      }
      100% {
        transform: translateX(-100%);
        opacity: 0;
      }
    }

    @keyframes slideInFromLeft {
      0% {
        transform: translateX(-100%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutToRight {
      0% {
        transform: translateX(0);
        opacity: 1;
      }
      100% {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;

  const getAnimationName = () => {
    if (!isAnimating || prefersReducedMotion) return "none";
    if (direction === "forward") return "slideInFromRight";
    if (direction === "backward") return "slideInFromLeft";
    return "none";
  };

  const pageStyle: CSSProperties = {
    animation: `${getAnimationName()} 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
  };

  return (
    <>
      <style>{animationStyle}</style>
      <div className={`w-full ${className}`} style={pageStyle}>
        {/* Full-width illustration with overlays */}
        <div className="shadow-2xl rounded-xl overflow-hidden w-full" style={{ background: "#0D0B1A" }}>
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            {page?.imageUrl ? (
              <img
                src={page.imageUrl}
                alt="Page illustration"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div className="absolute inset-0 bg-[#1A1033] flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-purple-300 opacity-40" />
              </div>
            )}
            {/* Page number — top left overlay */}
            <div className="absolute top-3 left-4 text-white text-sm font-semibold drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {pageNumber}
            </div>
            {/* Book title — top right overlay */}
            <div className="absolute top-3 right-4 text-white text-sm font-semibold drop-shadow-lg max-w-[50%] text-right line-clamp-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {bookTitle}
            </div>
          </div>

          {/* Text bar at bottom */}
          <div className="bg-white px-8 py-5 relative">
            <div className="prose prose-base max-w-4xl mx-auto">
              <p className="text-[#1A1033] leading-relaxed font-serif text-base md:text-lg m-0">
                {page?.content || ""}
              </p>
            </div>

            {/* A/B Choices */}
            {hasChoices && (
              <div className="mt-5 space-y-3 max-w-xl mx-auto">
                <p className="text-sm font-semibold text-[#2D1B69] text-center">{t("reader.choice")}</p>
                {[
                  { text: page?.choiceA, nextId: page?.nextPageIdA },
                  { text: page?.choiceB, nextId: page?.nextPageIdB },
                ]
                  .map((choice, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => onChoice(idx, choice.nextId)}
                      disabled={!choice.text}
                      className="w-full text-left px-5 py-4 bg-[#2D1B69] text-white rounded-xl text-base hover:bg-[#3D2B79] transition-colors border border-purple-700/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="font-semibold text-[#F59E0B] mr-2">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      {choice.text || "(No option)"}
                    </button>
                  ))}
              </div>
            )}

            {/* End of book */}
            {isLastPage && !hasChoices && (
              <div className="mt-8 text-center space-y-4">
                <div className="bg-gradient-to-r from-purple-900/60 to-amber-900/40 border border-amber-500/40 rounded-xl p-4 flex flex-col items-center gap-2">
                  <Trophy className="w-8 h-8 text-[#F59E0B]" />
                  <p className="text-base font-bold text-white">Adventure Complete!</p>
                  {justCompleted && <span className="text-green-400 font-semibold text-sm">Completed</span>}
                </div>
                <p className="text-lg font-bold text-[#2D1B69]">— {t("reader.theEnd")} —</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={onRestart} variant="outline" className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/10 text-sm">
                    <RotateCcw className="w-4 h-4 mr-2" />{t("reader.restart")}
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}
