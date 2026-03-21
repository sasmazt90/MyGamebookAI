import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Loader2, ChevronLeft, BookOpen, RotateCcw, Home,
  Volume2, VolumeX, Music, Music2, Trophy, GitBranch,
  Maximize, Minimize, Users, X, Columns2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReaderAudio } from "@/hooks/useReaderAudio";
import type { BookCategory } from "@/hooks/useReaderAudio";
import { ComicPageLayout } from "@/components/ComicPageLayout";
import { ComicSpreadLayout } from "@/components/ComicSpreadLayout";
import { useFlipbook } from "@/hooks/useFlipbook";
import type { FlipbookPage } from "@/hooks/useFlipbook";
import { useFlipbookDragCurl } from "@/hooks/useFlipbookDragCurl";
import { StoryTreeOverlay } from "@/components/StoryTreeOverlay";

// ---------------------------------------------------------------------------
// CSS keyframes injected once for the 3D page-turn animation
// ---------------------------------------------------------------------------
const FLIP_STYLES = `
/* Fairy Tale: vertical top-edge-fixed rotateX (bottom swings up toward viewer) */
@keyframes flipForwardFairyTale {
  0%   { transform: perspective(1200px) rotateX(0deg);   opacity: 1; transform-origin: top center; }
  100% { transform: perspective(1200px) rotateX(90deg);  opacity: 0; transform-origin: top center; }
}
@keyframes flipBackwardFairyTale {
  0%   { transform: perspective(1200px) rotateX(-90deg); opacity: 0; transform-origin: top center; }
  100% { transform: perspective(1200px) rotateX(0deg);   opacity: 1; transform-origin: top center; }
}
/* Non-fairy-tale: right page rotates around its left edge (spine).
   Applied to the right-page div only — left page stays stationary. */
@keyframes flipForwardRealistic {
  0%   { transform: perspective(1200px) rotateY(0deg);    opacity: 1; transform-origin: left center; }
  100% { transform: perspective(1200px) rotateY(-180deg); opacity: 1; transform-origin: left center; }
}
@keyframes flipBackwardRealistic {
  0%   { transform: perspective(1200px) rotateY(0deg);   opacity: 1; transform-origin: left center; }
  100% { transform: perspective(1200px) rotateY(180deg); opacity: 1; transform-origin: left center; }
}
@keyframes musicBar1 { 0%,100%{height:40%} 50%{height:90%} }
@keyframes musicBar2 { 0%,100%{height:70%} 50%{height:30%} }
@keyframes musicBar3 { 0%,100%{height:55%} 50%{height:80%} }
`;

// ---------------------------------------------------------------------------
// Fullscreen helpers
// ---------------------------------------------------------------------------

function useFullscreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!containerRef.current) {
        console.warn('Container ref not available for fullscreen');
        return;
      }

      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any)?.mozRequestFullScreen) {
          await (containerRef.current as any).mozRequestFullScreen();
        } else if ((containerRef.current as any)?.msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  }, []);

  return { containerRef, isFullscreen, toggleFullscreen };
}

// ---------------------------------------------------------------------------
// AudioToolbar component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CharacterCard type
// ---------------------------------------------------------------------------
type CharacterCard = { name: string; appearance: string; voice: string; role: string; photoUrl?: string; portraitUrl?: string };

// ---------------------------------------------------------------------------
// CharactersPanel overlay
// ---------------------------------------------------------------------------
function CharactersPanel({ cards, onClose }: { cards: CharacterCard[]; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-[#1A1033] border border-purple-700/50 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1033] border-b border-purple-900/30 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{t("reader.characters")}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Character list */}
        <div className="p-5 space-y-4">
          {cards.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">{t("reader.noCharacters")}</p>
          ) : (
            cards.map((card, i) => (
              <div key={i} className="flex gap-4 p-4 bg-[#0F0A1E] rounded-xl border border-purple-900/20">
                {/* Avatar - prefer the original uploaded photo when available */}
                {card.photoUrl && card.photoUrl.trim() ? (
                  <img src={card.photoUrl} alt={card.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-purple-600/40" />
                ) : card.portraitUrl && card.portraitUrl.trim() ? (
                  <img src={card.portraitUrl} alt={card.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-purple-600/40" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-purple-900/40 flex items-center justify-center flex-shrink-0 border-2 border-purple-600/40">
                    <span className="text-2xl">{card.role === "protagonist" ? "★" : card.role === "antagonist" ? "✖" : "◆"}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white text-sm">{card.name}</h3>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full capitalize",
                      card.role === "protagonist" ? "bg-purple-900/60 text-purple-300" :
                      card.role === "antagonist" ? "bg-red-900/60 text-red-300" :
                      "bg-gray-800 text-gray-400"
                    )}>{card.role}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed mb-1.5">{card.appearance}</p>
                  <p className="text-xs text-gray-500 italic">{card.voice}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface AudioToolbarProps {
  muted: boolean;
  setMuted: (v: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  isPlaying: boolean;
  startAmbience: () => void;
  stopAmbience: () => void;
  showTreeMap: boolean;
  onToggleTreeMap: () => void;
  hasChoices: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showCharacters: boolean;
  onToggleCharacters: () => void;
  hasCharacters: boolean;
  isComic?: boolean;
  useSpreadMode?: boolean;
  onToggleSpreadMode?: () => void;
}

function AudioToolbar({
  muted, setMuted,
  musicEnabled, setMusicEnabled,
  volume, setVolume,
  isPlaying, startAmbience, stopAmbience,
  showTreeMap, onToggleTreeMap,
  isFullscreen, onToggleFullscreen,
  showCharacters, onToggleCharacters, hasCharacters,
  isComic, useSpreadMode, onToggleSpreadMode,
}: AudioToolbarProps) {
  const { t } = useLanguage();
  const handleMuteToggle = () => setMuted(!muted);

  const handleMusicToggle = () => {
    const next = !musicEnabled;
    setMusicEnabled(next);
    if (next && !muted) startAmbience();
    else stopAmbience();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Full screen toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleFullscreen}
        className={cn(
          "text-xs px-2 py-1 h-8 transition-colors",
          isFullscreen ? "text-[#7C3AED] hover:text-purple-300" : "text-gray-500 hover:text-gray-300"
        )}
        title={isFullscreen ? "Exit fullscreen (ESC)" : "Enter fullscreen"}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </Button>

      {/* Characters panel toggle */}
      {hasCharacters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCharacters}
          className={cn(
            "text-xs px-2 py-1 h-8 transition-colors",
            showCharacters ? "text-[#7C3AED] hover:text-purple-300" : "text-gray-500 hover:text-gray-300"
          )}
          title="Characters"
        >
          <Users className="w-4 h-4" />
        </Button>
      )}

      {/* Spread mode toggle (only for comics in single-page mode) - HIDDEN for now */}
      {false && isComic && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSpreadMode}
          className={cn(
            "text-xs px-2 py-1 h-8 transition-colors",
            useSpreadMode ? "text-[#7C3AED] hover:text-purple-300" : "text-gray-500 hover:text-gray-300"
          )}
          title={useSpreadMode ? "Single page" : "Two-page spread"}
        >
          <Columns2 className="w-4 h-4" />
        </Button>
      )}

      {/* Story map toggle - REMOVED */}

      {/* Music toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleMusicToggle}
        className={cn(
          "text-xs px-2 py-1 h-8 transition-colors",
          musicEnabled && !muted
            ? "text-[#7C3AED] hover:text-purple-400"
            : "text-gray-500 hover:text-gray-300"
        )}
        title={musicEnabled ? "Disable ambient music" : "Enable ambient music"}
      >
        {musicEnabled && !muted ? (
          <Music className="w-4 h-4" />
        ) : (
          <Music2 className="w-4 h-4 opacity-40" />
        )}
        {isPlaying && !muted && musicEnabled && (
          <span className="ml-1 flex gap-0.5 items-end h-3">
            <span className="w-0.5 bg-[#7C3AED] rounded-full animate-[musicBar1_0.8s_ease-in-out_infinite]" style={{ height: "40%" }} />
            <span className="w-0.5 bg-[#7C3AED] rounded-full animate-[musicBar2_0.8s_ease-in-out_infinite_0.15s]" style={{ height: "70%" }} />
            <span className="w-0.5 bg-[#7C3AED] rounded-full animate-[musicBar3_0.8s_ease-in-out_infinite_0.3s]" style={{ height: "55%" }} />
          </span>
        )}
      </Button>

      {/* Mute toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleMuteToggle}
        className={cn(
          "text-xs px-2 py-1 h-8 transition-colors",
          muted ? "text-gray-500 hover:text-gray-300" : "text-gray-300 hover:text-white"
        )}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </Button>

      {/* Volume slider -- always visible */}
      <div className="flex items-center gap-1.5 w-24">
        <Slider
          value={[Math.round(volume * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => setVolume(v / 100)}
          className="w-full"
          disabled={muted}
        />
        <span className="text-xs text-gray-500 w-7 text-right">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Reader component
// ---------------------------------------------------------------------------

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [choiceHistory, setChoiceHistory] = useState<number[]>([]);
  const [showCover, setShowCover] = useState(true);
  const [showBackCover, setShowBackCover] = useState(false);
  const [madeChoice, setMadeChoice] = useState(false);
  const [cameFromBranch, setCameFromBranch] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [showTreeMap, setShowTreeMap] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [useSpreadMode, setUseSpreadMode] = useState(false);
  const { containerRef: fullscreenRef, isFullscreen, toggleFullscreen } = useFullscreen();

  const bookId = parseInt(id || "0");

  const { data: bookData, isLoading: bookLoading } = trpc.books.get.useQuery(
    { id: bookId },
    { enabled: !!bookId }
  );

  const { data: pagesData, isLoading: pagesLoading } = trpc.books.getPages.useQuery(
    { bookId },
    { enabled: !!bookId && isAuthenticated }
  );

  const saveProgress = trpc.books.saveProgress.useMutation();

  const book = bookData;
  const pages = (pagesData?.pages || []) as FlipbookPage[];
  const characterCards = (pagesData?.characterCards || []) as CharacterCard[];
  const currentPage = pages[currentPageIndex];
  const nextPage = pages[currentPageIndex + 1];
  const bookCategory = (book?.book?.category ?? "fantasy_scifi") as BookCategory;
  const isComic = bookCategory === "comic";
  const isFairyTale = bookCategory === "fairy_tale";
  // Spread mode is ALWAYS enabled for all non-fairy-tale books (comics and others)
  // Fairy tales show one wide landscape page at a time
  const forceSpreadMode = !isFairyTale;
  const hasNonLinearGraph = pages.some((page, index) => {
    if (!page?.nextPageIdA) return false;
    const flatNextId = pages[index + 1]?.id;
    return flatNextId != null && page.nextPageIdA !== flatNextId;
  });
  const effectiveSpreadMode = hasNonLinearGraph ? false : forceSpreadMode ? true : useSpreadMode;
  const step = hasNonLinearGraph ? 1 : isComic ? (effectiveSpreadMode ? 2 : 1) : isFairyTale ? 1 : 2;
  const parseRoutePageNumber = useCallback((page?: FlipbookPage | null, fallback = 1) => {
    const match = page?.branchPath?.match(/\|r(\d+)/);
    return match ? parseInt(match[1], 10) : fallback;
  }, []);
  const targetReadablePageCount = pages.reduce((max, page, index) => Math.max(max, parseRoutePageNumber(page, index + 1)), 0);
  const currentRoutePageNumber = parseRoutePageNumber(currentPage, Math.max(1, currentPageIndex + 1));
  const nextRoutePageNumber = parseRoutePageNumber(nextPage, currentRoutePageNumber + 1);

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  const {
    muted, setMuted,
    musicEnabled, setMusicEnabled,
    volume, setVolume,
    isPlaying, playPageTurn, startAmbience, stopAmbience,
    startPageSfx, stopPageSfx,
  } = useReaderAudio(bookCategory);

  useEffect(() => {
    // Only start ambience from page 3 onwards (skip pages 0, 1, 2).
    // startAmbience has an isPlaying guard so page-turn re-runs are no-ops.
    // No cleanup return here — stopping on every dep change would kill music mid-page.
    if (!showCover && !showBackCover && !muted && musicEnabled && currentPageIndex >= 3) startAmbience();
    else if (showCover || showBackCover || muted || !musicEnabled) stopAmbience();
  }, [showCover, showBackCover, currentPageIndex, muted, musicEnabled, startAmbience, stopAmbience]);

  // Per-page looping SFX: starts/restarts when page changes, stops on cover/back cover
  useEffect(() => {
    if (showCover || showBackCover) {
      stopPageSfx();
      return;
    }
    const sfxTags = (currentPage?.sfxTags as string[] | null) ?? [];
    if (sfxTags.length > 0) {
      startPageSfx(sfxTags);
    } else {
      stopPageSfx();
    }
  }, [currentPageIndex, showCover, showBackCover, startPageSfx, stopPageSfx]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const findPageIndexById = useCallback((dbId: number): number => {
    const idx = pages.findIndex(p => p.id === dbId);
    return idx >= 0 ? idx : currentPageIndex + step;
  }, [pages, currentPageIndex, step]);

  const isEndingPage = useCallback((pageIndex: number) => {
    const page = pages[pageIndex];
    if (!page) return false;
    return !page.choiceA && !page.choiceB && !page.nextPageIdA && !page.nextPageIdB;
  }, [pages]);

  const handleChoice = useCallback((
    _choiceIndex: number,
    nextPageDbId: number | null | undefined
  ) => {
    const targetIndex = nextPageDbId != null
      ? findPageIndexById(nextPageDbId)
      : currentPageIndex + step;

    const targetPage = pages[targetIndex];
    // Only play sound from page 3 onwards (skip pages 0, 1, 2)
    if (targetIndex >= 2) {
      const sfxTags = (targetPage?.sfxTags as string[] | null) ?? undefined;
      playPageTurn(sfxTags);
    }

    setChoiceHistory(prev => [...prev, currentPageIndex]);
    setCurrentPageIndex(targetIndex);
    setMadeChoice(true);
    setCameFromBranch(true);
    const isEnding = isEndingPage(targetIndex);
    if (isEnding) setJustCompleted(true);
    const targetPageId = targetPage?.id ?? nextPageDbId ?? 0;
    saveProgress.mutate({
      bookId,
      currentPageId: targetPageId,
      branchPath: targetPage?.branchPath ?? "root",
      isEndingNode: isEnding,
    });
  }, [currentPageIndex, bookId, playPageTurn, saveProgress, isEndingPage, findPageIndexById, pages, step]);

  const handleEndReached = useCallback(() => {
    setShowBackCover(true);
    stopAmbience();
    stopPageSfx();
  }, [stopAmbience, stopPageSfx]);

  const handleRestart = useCallback(() => {
    setCurrentPageIndex(0);
    setChoiceHistory([]);
    setShowCover(true);
    setShowBackCover(false);
    setMadeChoice(false);
    setCameFromBranch(false);
    stopAmbience();
    stopPageSfx();
    saveProgress.mutate({ bookId, currentPageId: pages[0]?.id ?? 0, branchPath: pages[0]?.branchPath ?? "root" });
  }, [bookId, pages, saveProgress, stopAmbience, stopPageSfx]);

  const handleBeginReading = useCallback(() => {
    // Don't play sound on first 2 pages (pages 0-2)
    // Set to page 1 (index 1) which is still silent
    setCurrentPageIndex(1);
    setShowCover(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Flipbook hook
  // ---------------------------------------------------------------------------

  const hasChoices = !!(currentPage?.choiceA != null || currentPage?.choiceB != null);

  const handleGoTo = useCallback((index: number) => {
    const targetPage = pages[index];
    // Only play sound from page 3 onwards (skip pages 0, 1, 2)
    if (index >= 2) {
      const sfxTags = (targetPage?.sfxTags as string[] | null) ?? undefined;
      playPageTurn(sfxTags);
    }
    setCameFromBranch(false);
    setCurrentPageIndex(index);
    const isEnding = isEndingPage(index);
    if (isEnding) setJustCompleted(true);
    saveProgress.mutate({ bookId, currentPageId: targetPage?.id ?? 0, branchPath: targetPage?.branchPath ?? "root", isEndingNode: isEnding });
  }, [pages, playPageTurn, isEndingPage, saveProgress, bookId]);

  const handleReturnToCover = useCallback(() => {
    // Don't play sound when returning to cover
    setShowCover(true);
    stopAmbience();
    stopPageSfx();
  }, [stopAmbience, stopPageSfx]);

  const {
    flipDirection,
    isAnimating,
    flipForward,
    flipBackward,
    containerProps,
    prefersReducedMotion,
  } = useFlipbook({
    pages,
    currentPageIndex,
    onGoTo: handleGoTo,
    hasChoices,
    showCover: showCover || showBackCover,
    onReturnToCover: handleReturnToCover,
    onEnd: handleEndReached,
    step,
  });

  // Drag-to-turn corner interaction
  const { dragProgress, isDraggingCorner, curlStyle, cornerIndicatorStyle, cornerCursorStyle } = useFlipbookDragCurl({
    containerRef: fullscreenRef,
    onFlipForward: flipForward,
    onFlipBackward: flipBackward,
    isAnimating,
    showCover: showCover || showBackCover,
    hasChoices,
  });

  // Keyboard shortcut: F key toggles fullscreen -- keep this useEffect above early returns (React error #310)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullscreen]);

  // ---------------------------------------------------------------------------
  // Auth / loading guards
  // ---------------------------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Sign in to read</h2>
          <Button onClick={() => (window.location.href = "/login")} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
            Sign In
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (bookLoading || pagesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!book) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Book not found</h2>
          <p className="text-gray-400 mb-4">This book doesn't exist or you don't have access to it.</p>
          <Link href="/library">
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Back to Library</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const isLastPage = currentPageIndex >= pages.length - 1;
  const coverUrl = book?.book?.coverImageUrl;
  const bookTitle = book?.book?.title;
  const authorName = book?.authorName;

  const genreLabel = (bookCategory as string)
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  // Animation class for the spread container -- fairy tale rotateX, others rotateY
  const flipAnimClass = !prefersReducedMotion && flipDirection
    ? isFairyTale
      ? flipDirection === "forward"
        ? "animate-[flipForwardFairyTale_0.38s_cubic-bezier(0.4,0,0.2,1)]"
        : "animate-[flipBackwardFairyTale_0.38s_cubic-bezier(0.4,0,0.2,1)]"
      : flipDirection === "forward"
        ? "animate-[flipForwardRealistic_0.38s_cubic-bezier(0.4,0,0.2,1)]"
        : "animate-[flipBackwardRealistic_0.38s_cubic-bezier(0.4,0,0.2,1)]"
    : "";

  return (
    <div ref={fullscreenRef} className="min-h-screen bg-[#0A0818] text-white flex flex-col">
      {/* Inject CSS keyframes */}
      <style>{FLIP_STYLES}</style>

      {/* Reader Header -- hidden in fullscreen */}
      <div className={cn(
        "bg-[#1A1033] border-b border-purple-900/30 px-4 py-3 flex items-center justify-between transition-all duration-300 pointer-events-auto",
        isFullscreen && "opacity-0 hover:opacity-100 absolute top-0 left-0 right-0 z-50"
      )}>
        <Link href="/library" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />
          {t("reader.backToLibrary")}
        </Link>

        <div className="text-center">
          <h1 className="text-sm font-semibold text-white line-clamp-1">{bookTitle}</h1>
          <p className="text-xs text-gray-400">
            {showCover ? "Cover" : showBackCover ? "Back Cover" : `Page ${currentRoutePageNumber} of ${targetReadablePageCount || pages.length}`}
          </p>
        </div>

        <AudioToolbar
          muted={muted}
          setMuted={setMuted}
          musicEnabled={musicEnabled}
          setMusicEnabled={setMusicEnabled}
          volume={volume}
          setVolume={setVolume}
          isPlaying={isPlaying}
          startAmbience={startAmbience}
          stopAmbience={stopAmbience}
          showTreeMap={showTreeMap}
          onToggleTreeMap={() => setShowTreeMap(v => !v)}
          hasChoices={hasChoices}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          showCharacters={showCharacters}
          onToggleCharacters={() => setShowCharacters(v => !v)}
          hasCharacters={characterCards.length > 0}
          isComic={isComic}
          useSpreadMode={useSpreadMode}
          onToggleSpreadMode={() => setUseSpreadMode(v => !v)}
        />
      </div>

      {/* Characters Panel */}
      {showCharacters && characterCards.length > 0 && (
        <CharactersPanel cards={characterCards} onClose={() => setShowCharacters(false)} />
      )}

      {/* Story Tree Overlay */}
      {showTreeMap && (
        <StoryTreeOverlay
          pages={pages}
          currentPageIndex={currentPageIndex}
          choiceHistory={choiceHistory}
          onClose={() => setShowTreeMap(false)}
          onNavigate={(idx) => {
            setShowTreeMap(false);
            handleGoTo(idx);
          }}
        />
      )}

      {/* Two-page spread -- drag/swipe container */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
        {/* Left edge zone (click to go back) */}
        {!showCover && !showBackCover && !cameFromBranch && (
          <button
            onClick={flipBackward}
            disabled={isAnimating}
            aria-label="Previous page"
            className="absolute left-0 top-0 h-full w-12 md:w-16 z-10 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="bg-black/30 rounded-r-full p-2">
              <ChevronLeft className="w-5 h-5 text-white/60" />
            </div>
          </button>
        )}

        {/* Right edge zone (click to go forward) */}
        {!showCover && !showBackCover && !hasChoices && (
          <button
            onClick={flipForward}
            disabled={isAnimating}
            aria-label="Next page"
            className="absolute right-0 top-0 h-full w-12 md:w-16 z-10 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="bg-black/30 rounded-l-full p-2">
              <ChevronLeft className="w-5 h-5 text-white/60 rotate-180" />
            </div>
          </button>
        )}

        {/* Main spread container -- receives swipe/drag events */}
        {/* Comics: portrait (max-w-xl), Fairy Tale: wide landscape (max-w-5xl), Others: two-page spread (max-w-5xl) */}
        <div
          {...containerProps}
          className={cn(
            "w-full relative",
            isComic && !showCover && !effectiveSpreadMode ? "max-w-xl" : "max-w-5xl",
            isFairyTale ? flipAnimClass : "",
          )}
          style={{
            ...curlStyle,
            ...(isDraggingCorner ? {} : { transformOrigin: isFairyTale ? "top center" : undefined }),
            perspective: "1200px",
            cursor: cornerCursorStyle,
          }}
        >
          {/* Corner drag indicator */}
          <div style={cornerIndicatorStyle} />
          {/* Content */}
          {showBackCover ? (
            /* ── Back Cover ──────────────────────────────────────────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 shadow-2xl rounded-xl overflow-hidden">
              {/* Left: decorative back page */}
              <div className="bg-[#F5F0E8] text-[#1A1033] p-10 min-h-[500px] flex flex-col justify-center items-center text-center">
                <div className="w-full max-w-xs">
                  <div className="w-16 h-1 bg-[#F59E0B] mx-auto mb-8" />
                  <p className="text-4xl font-serif italic text-[#2D1B69] mb-6">{t("reader.theEnd")}</p>
                  <p className="text-sm text-gray-600 mb-10">{bookTitle}</p>
                  <div className="w-16 h-1 bg-[#7C3AED] mx-auto mb-10" />
                  <div className="flex flex-col gap-3">
                    <Button onClick={handleRestart} variant="outline" className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/10 text-sm">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t("reader.restart")}
                    </Button>
                    <Link href="/library">
                      <Button className="w-full bg-[#2D1B69] text-white hover:bg-[#3D2B79] text-sm font-bold">
                        <Home className="w-4 h-4 mr-2" />
                        {t("reader.backToLibrary")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
              {/* Right: back cover image (same as front, slightly dimmed) */}
              <div className="relative bg-[#0D0B1A] min-h-[500px] overflow-hidden">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={bookTitle || "Book Cover"}
                    className="w-full h-full object-cover absolute inset-0 opacity-40"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center min-h-[500px]">
                    <BookOpen className="w-20 h-20 text-purple-700 opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-end justify-center pb-10">
                  <p className="text-xs uppercase tracking-widest text-white/60">{genreLabel}</p>
                </div>
              </div>
            </div>
          ) : showCover ? (
            /* -- Cover Spread -- */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 shadow-2xl rounded-xl overflow-hidden">
                {/* Left: Cover image */}
                <div className="relative bg-[#0D0B1A] min-h-[500px] overflow-hidden">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={bookTitle || "Book Cover"}
                      className="w-full h-full object-cover absolute inset-0"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center min-h-[500px]">
                      <div className="text-center">
                        <BookOpen className="w-20 h-20 text-purple-700 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm">{t("reader.noCoverImage")}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Title page */}
                <div className="bg-[#F5F0E8] text-[#1A1033] p-10 min-h-[500px] flex flex-col justify-center items-center text-center">
                  <div className="w-full max-w-xs">
                    <div className="w-16 h-1 bg-[#7C3AED] mx-auto mb-8" />
                    <h1 className="text-3xl font-bold text-[#1A1033] font-serif leading-tight mb-4">
                      {bookTitle}
                    </h1>
                    {authorName && (
                      <p className="text-base text-gray-600 italic mb-3">{t("reader.by")} {authorName}</p>
                    )}
                    <p className="text-xs uppercase tracking-widest text-[#7C3AED] mb-8">
                      {genreLabel}
                    </p>
                    <div className="w-16 h-1 bg-[#F59E0B] mx-auto mb-10" />
                    <Button
                      onClick={handleBeginReading}
                      className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-3 text-sm font-semibold w-full"
                    >
                      {t("reader.beginReading")}
                    </Button>
                    <p className="text-xs text-gray-400 mt-4">
                      {t("reader.swipeHint")}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* -- Story Pages Spread -- */
            <>
              {isComic && effectiveSpreadMode ? (
                /* -- Comic Spread: Two pages side-by-side -- */
                <ComicSpreadLayout
                  leftPanels={(() => {
                    const raw = Array.isArray(currentPage?.panels) ? currentPage.panels as unknown[] : [];
                    const fallback = typeof currentPage?.imageUrl === "string" ? currentPage.imageUrl : "";
                    const normalised = raw.slice(0, 3).map((item) => {
                      if (typeof item === "string") {
                        return { imageUrl: item, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null };
                      } else if (item && typeof item === "object" && "imageUrl" in item && typeof (item as Record<string, unknown>).imageUrl === "string") {
                        const p = item as Record<string, unknown>;
                        return {
                          imageUrl: p.imageUrl as string,
                          narration: typeof p.narration === "string" ? p.narration : "",
                          dialogue: typeof p.dialogue === "string" ? p.dialogue : null,
                          speaker: typeof p.speaker === "string" ? p.speaker : null,
                          bubbleType: typeof p.bubbleType === "string" ? p.bubbleType as "speech" | "thought" | "shout" : null,
                          position: typeof p.position === "string" ? p.position as "top-left" | "top-right" | "bottom-left" | "bottom-right" : null,
                        };
                      } else {
                        return { imageUrl: fallback, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null };
                      }
                    });
                    while (normalised.length < 3) {
                      normalised.push({ imageUrl: fallback, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null });
                    }
                    return normalised;
                  })()}
                  rightPanels={(() => {
                    const raw = Array.isArray(nextPage?.panels) ? nextPage.panels as unknown[] : [];
                    const fallback = typeof nextPage?.imageUrl === "string" ? nextPage.imageUrl : "";
                    const normalised = raw.slice(0, 3).map((item) => {
                      if (typeof item === "string") {
                        return { imageUrl: item, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null };
                      } else if (item && typeof item === "object" && "imageUrl" in item && typeof (item as Record<string, unknown>).imageUrl === "string") {
                        const p = item as Record<string, unknown>;
                        return {
                          imageUrl: p.imageUrl as string,
                          narration: typeof p.narration === "string" ? p.narration : "",
                          dialogue: typeof p.dialogue === "string" ? p.dialogue : null,
                          speaker: typeof p.speaker === "string" ? p.speaker : null,
                          bubbleType: typeof p.bubbleType === "string" ? p.bubbleType as "speech" | "thought" | "shout" : null,
                          position: typeof p.position === "string" ? p.position as "top-left" | "top-right" | "bottom-left" | "bottom-right" : null,
                        };
                      } else {
                        return { imageUrl: fallback, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null };
                      }
                    });
                    while (normalised.length < 3) {
                      normalised.push({ imageUrl: fallback, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null });
                    }
                    return normalised;
                  })()}
                  leftPageNumber={currentRoutePageNumber}
                  rightChoiceSlot={
                    hasChoices ? (
                      <div className="space-y-3">
                        {[
                          { text: currentPage?.choiceA, nextId: currentPage?.nextPageIdA },
                          { text: currentPage?.choiceB, nextId: currentPage?.nextPageIdB },
                        ]
                          .filter(c => c.text != null)
                          .map((choice, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleChoice(idx, choice.nextId)}
                              className="w-full text-left px-4 py-3 bg-[#1A1033] text-white rounded text-sm hover:bg-[#2A1A43] transition-colors border-2 border-yellow-400 flex items-start gap-2"
                              style={{ fontFamily: "'Bangers', 'Impact', sans-serif", letterSpacing: "0.05em" }}
                            >
                              <span className="font-bold text-yellow-400 flex-shrink-0">{String.fromCharCode(65 + idx)}.</span>
                              <span className="flex-1 break-words">{choice.text}</span>
                            </button>
                          ))}
                      </div>
                    ) : undefined
                  }
                />
              ) : isComic ? (
                /* -- Comic: ComicPageLayout with top panel + two bottom panels from panels[] -- */
                <ComicPageLayout
                  panels={(() => {
                    // Runtime panels shape validation:
                    // DB JSON can be: string[] (old format), ComicPanel[] (new format), or unknown
                    const raw = Array.isArray(currentPage?.panels) ? currentPage.panels as unknown[] : [];
                    const fallback = typeof currentPage?.imageUrl === "string" ? currentPage.imageUrl : "";
                    const normalised = raw.slice(0, 3).map((item) => {
                      if (typeof item === "string") {
                        // Old format: plain string URL
                        return { imageUrl: item, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null };
                      } else if (item && typeof item === "object" && "imageUrl" in item && typeof (item as Record<string, unknown>).imageUrl === "string") {
                        // New format: ComicPanel object
                        const p = item as Record<string, unknown>;
                        return {
                          imageUrl: p.imageUrl as string,
                          narration: typeof p.narration === "string" ? p.narration : "",
                          dialogue: typeof p.dialogue === "string" ? p.dialogue : null,
                          speaker: typeof p.speaker === "string" ? p.speaker : null,
                          bubbleType: typeof p.bubbleType === "string" ? p.bubbleType as "speech" | "thought" | "shout" : null,
                          position: typeof p.position === "string" ? p.position as "top-left" | "top-right" | "bottom-left" | "bottom-right" : null,
                        };
                      } else {
                        // Unknown shape: fallback gracefully
                        return { imageUrl: fallback, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null };
                      }
                    });
                    // Ensure exactly 3 panels (pad with fallback if needed)
                    while (normalised.length < 3) {
                      normalised.push({ imageUrl: fallback, narration: "", dialogue: null, speaker: null, bubbleType: null, position: null });
                    }
                    return normalised;
                  })()}
                  pageNumber={currentRoutePageNumber}
                  choiceSlot={
                    hasChoices && !madeChoice ? (
                      <div className="space-y-3">
                        {[
                          { text: currentPage?.choiceA, nextId: currentPage?.nextPageIdA },
                          { text: currentPage?.choiceB, nextId: currentPage?.nextPageIdB },
                        ]
                          .filter(c => c.text != null)
                          .map((choice, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleChoice(idx, choice.nextId)}
                              className="w-full text-left px-4 py-3 bg-[#1A1033] text-white rounded text-sm hover:bg-[#2A1A43] transition-colors border-2 border-yellow-400 flex items-start gap-2"
                              style={{ fontFamily: "'Bangers', 'Impact', sans-serif", letterSpacing: "0.05em" }}
                            >
                              <span className="font-bold text-yellow-400 flex-shrink-0">{String.fromCharCode(65 + idx)}.</span>
                              <span className="flex-1 break-words">{choice.text}</span>
                            </button>
                          ))}
                      </div>
                    ) : undefined
                  }
                  endSlot={
                    isLastPage && !hasChoices ? (
                      <div className="text-center space-y-3">
                        <div className="bg-yellow-900/40 border-2 border-yellow-400 rounded-xl p-4 flex flex-col items-center gap-2">
                          <Trophy className="w-8 h-8 text-yellow-400" />
                          <p className="text-base font-bold text-yellow-400 uppercase tracking-wide" style={{ fontFamily: "'Bangers', 'Impact', sans-serif" }}>Adventure Complete!</p>
                          {justCompleted && <span className="text-green-400 font-bold text-sm">Completed</span>}
                        </div>
                        <p className="text-lg font-bold text-white" style={{ fontFamily: "'Bangers', 'Impact', sans-serif" }}>~ {t("reader.theEnd")} ~</p>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-gray-300">Close this book and return to your library</p>
                          <div className="flex gap-3 justify-center">
                            <Button onClick={handleRestart} variant="outline" className="border-2 border-yellow-400 text-yellow-400 text-sm">
                              <RotateCcw className="w-4 h-4 mr-2" />{t("reader.restart")}
                            </Button>
                            <Link href="/library">
                              <Button className="close-book-button bg-yellow-400 text-black text-sm hover:bg-yellow-300 font-bold">
                                <Home className="w-4 h-4 mr-2" />Close Book
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : undefined
                  }
                  className="w-full"
                />
              ) : isFairyTale ? (
                /* -- Fairy Tale: full-viewport landscape -- matches reference screenshot -- */
                <div className="shadow-2xl rounded-xl overflow-hidden w-full" style={{ background: "#0D0B1A" }}>
                  {/* Full-width illustration with overlays */}
                  <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                    {currentPage?.imageUrl ? (
                      <img
                        src={currentPage.imageUrl}
                        alt="Page illustration"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[#1A1033] flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-purple-300 opacity-40" />
                      </div>
                    )}
                    {/* Page number -- top left overlay */}
                    <div className="absolute top-3 left-4 text-white text-sm font-semibold drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                        {currentRoutePageNumber}
                    </div>
                    {/* Book title -- top right overlay */}
                    <div className="absolute top-3 right-4 text-white text-sm font-semibold drop-shadow-lg max-w-[50%] text-right line-clamp-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                      {bookTitle}
                    </div>
                  </div>

                  {/* Text bar at bottom */}
                  <div className="bg-white px-8 py-5 relative">
                    <div className="prose prose-base max-w-4xl mx-auto">
                      <p className="text-[#1A1033] leading-relaxed font-serif text-base md:text-lg m-0">
                        {currentPage?.content || ""}
                      </p>
                    </div>

                    {/* A/B Choices */}
                    {hasChoices && (
                      <div className="mt-5 space-y-3 max-w-xl mx-auto">
                        {[
                          { text: currentPage?.choiceA, nextId: currentPage?.nextPageIdA },
                          { text: currentPage?.choiceB, nextId: currentPage?.nextPageIdB },
                        ]
                          .filter(c => c.text != null)
                          .map((choice, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleChoice(idx, choice.nextId)}
                              className="w-full text-left px-5 py-4 bg-[#2D1B69] text-white rounded-xl text-base hover:bg-[#3D2B79] transition-colors border border-purple-700/30"
                            >
                              <span className="font-semibold text-[#F59E0B] mr-2">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              {choice.text}
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
                        <p className="text-lg font-bold text-[#2D1B69]">~ {t("reader.theEnd")} ~</p>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-[#2D1B69]">Close this book and return to your library</p>
                          <div className="flex gap-3 justify-center">
                            <Button onClick={handleRestart} variant="outline" className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/10 text-sm">
                              <RotateCcw className="w-4 h-4 mr-2" />{t("reader.restart")}
                            </Button>
                            <Link href="/library">
                              <Button className="close-book-button bg-[#2D1B69] text-white hover:bg-[#3D2B79] text-sm font-bold">
                                <Home className="w-4 h-4 mr-2" />Close Book
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* -- Non-comic, non-fairy-tale: two-page portrait book spread -- */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 shadow-2xl rounded-xl overflow-hidden">
                  {/* Left page */}
                  <div className="bg-[#F5F0E8] text-[#1A1033] p-8 md:p-10 min-h-[500px] relative border-r border-[#D4C9A8]">
                    <div className="absolute bottom-4 left-6 text-xs text-gray-500">
                      {currentRoutePageNumber}
                    </div>
                    {currentPage?.imageUrl && (
                      <div className="mb-6 rounded-lg overflow-hidden" style={{ aspectRatio: "4/3" }}>
                        <img
                          src={currentPage.imageUrl}
                          alt="Page illustration"
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        />
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none">
                      <p className="text-[#2D1B69] leading-relaxed font-serif text-base">
                        {currentPage?.content || ""}
                      </p>
                    </div>
                  </div>

                  {/* Right page */}
                  <div
                    className={cn("bg-[#EDE8DC] text-[#1A1033] p-8 md:p-10 min-h-[500px] relative", flipAnimClass)}
                    style={flipAnimClass ? { transformOrigin: "left center" } : undefined}
                  >
                    <div className="absolute bottom-4 right-6 text-xs text-gray-500">
                        {nextRoutePageNumber}
                    </div>
                    {nextPage ? (
                      <>
                        {nextPage.imageUrl && (
                          <div className="mb-6 rounded-lg overflow-hidden" style={{ aspectRatio: "4/3" }}>
                            <img
                              src={nextPage.imageUrl}
                              alt="Page illustration"
                              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                            />
                          </div>
                        )}
                        <div className="prose prose-sm max-w-none">
                          <p className="text-[#2D1B69] leading-relaxed font-serif text-base">
                            {nextPage.content}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500">
                          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm italic">End of this section</p>
                        </div>
                      </div>
                    )}

                    {/* A/B Choices */}
                    {hasChoices && (
                      <div className="mt-6 space-y-3">
                        {[
                          { text: currentPage?.choiceA, nextId: currentPage?.nextPageIdA },
                          { text: currentPage?.choiceB, nextId: currentPage?.nextPageIdB },
                        ]
                          .filter(c => c.text != null)
                          .map((choice, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleChoice(idx, choice.nextId)}
                              className="w-full text-left px-4 py-3 bg-[#2D1B69] text-white rounded-lg text-sm hover:bg-[#3D2B79] transition-colors border border-purple-700/30"
                            >
                              <span className="font-semibold text-[#F59E0B] mr-2">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              {choice.text}
                            </button>
                          ))}
                      </div>
                    )}

                    {/* End of book */}
                    {isLastPage && !hasChoices && (
                      <div className="mt-6 text-center space-y-4">
                        <div className="bg-gradient-to-r from-purple-900/60 to-amber-900/40 border border-amber-500/40 rounded-xl p-4 flex flex-col items-center gap-2">
                          <Trophy className="w-8 h-8 text-[#F59E0B]" />
                          <p className="text-base font-bold text-white">Adventure Complete!</p>
                          <p className="text-xs text-gray-300">
                            You've reached the end of this story.{" "}
                            {justCompleted && <span className="text-green-400 font-semibold">Completed</span>}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-[#2D1B69]">~ {t("reader.theEnd")} ~</p>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-[#2D1B69]">Close this book and return to your library</p>
                          <div className="flex gap-3 justify-center">
                            <Button
                              onClick={handleRestart}
                              variant="outline"
                              className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/10 text-sm"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              {t("reader.restart")}
                            </Button>
                            <Link href="/library">
                              <Button className="close-book-button bg-[#2D1B69] text-white hover:bg-[#3D2B79] text-sm font-bold">
                                <Home className="w-4 h-4 mr-2" />
                                Close Book
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom nav: Prev / dots / Next -- matches reference screenshot */}
              <div className="flex items-center justify-between mt-4 px-2">
                {/* Prev button */}
                <button
                  onClick={flipBackward}
                  disabled={isAnimating || currentPageIndex === 0 || cameFromBranch}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    (currentPageIndex === 0 || cameFromBranch)
                      ? "text-gray-600 cursor-not-allowed opacity-40"
                      : "text-white bg-[#7C3AED] hover:bg-[#6D28D9] shadow-md"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("reader.prev") || "Prev"}
                </button>

                {/* Dot indicators */}
                <div className="flex items-center gap-1.5">
                  {pages.slice(0, Math.min(pages.length, 15)).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleGoTo(i)}
                      className={cn(
                        "rounded-full transition-all duration-200",
                        i === currentPageIndex
                          ? "w-3 h-3 bg-[#7C3AED]"
                          : "w-2 h-2 bg-purple-900/40 hover:bg-purple-700/60"
                      )}
                    />
                  ))}
                  {pages.length > 15 && (
                    <span className="text-xs text-gray-500 ml-1">{currentRoutePageNumber}/{targetReadablePageCount || pages.length}</span>
                  )}
                </div>

                {/* Next button */}
                <button
                  onClick={flipForward}
                  disabled={isAnimating || (isLastPage && !hasChoices)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    (isLastPage && !hasChoices)
                      ? "text-gray-600 cursor-not-allowed opacity-40"
                      : "text-white bg-[#7C3AED] hover:bg-[#6D28D9] shadow-md"
                  )}
                >
                  {t("reader.next") || "Next"}
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
