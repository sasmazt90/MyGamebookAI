/**
 * ComicSpreadLayout
 *
 * Renders two comic book pages side-by-side in landscape mode:
 *   ┌──────────────────┬──────────────────┐
 *   │  Left Page       │  Right Page      │
 *   │  (Page N)        │  (Page N+1)      │
 *   │  3-panel layout  │  3-panel layout  │
 *   └──────────────────┴──────────────────┘
 *
 * Each page displays the standard 3-panel comic layout (1 wide top, 2 bottom).
 */

import { cn } from "@/lib/utils";
import { ComicPageLayout, ComicPanel } from "./ComicPageLayout";

interface ComicSpreadLayoutProps {
  leftPanels: ComicPanel[];
  rightPanels: ComicPanel[];
  leftPageNumber?: number;
  rightPageNumber?: number;
  leftPlaceholder?: React.ReactNode;
  rightPlaceholder?: React.ReactNode;
  leftChoiceSlot?: React.ReactNode;
  rightChoiceSlot?: React.ReactNode;
  leftEndSlot?: React.ReactNode;
  rightEndSlot?: React.ReactNode;
  className?: string;
}

export function ComicSpreadLayout({
  leftPanels,
  rightPanels,
  leftPageNumber,
  rightPageNumber,
  leftPlaceholder,
  rightPlaceholder,
  leftChoiceSlot,
  rightChoiceSlot,
  leftEndSlot,
  rightEndSlot,
  className,
}: ComicSpreadLayoutProps) {
  return (
    <div
      className={cn(
        "flex gap-4 w-full justify-center items-stretch",
        "landscape:gap-6",
        className,
      )}
    >
      {/* Left page */}
      <div className="flex-1 max-w-2xl">
        <ComicPageLayout
          panels={leftPanels}
          pageNumber={leftPageNumber}
          placeholder={leftPlaceholder}
          choiceSlot={leftChoiceSlot}
          endSlot={leftEndSlot}
          className="h-full"
        />
      </div>

      {/* Right page */}
      <div className="flex-1 max-w-2xl">
        <ComicPageLayout
          panels={rightPanels}
          pageNumber={rightPageNumber}
          placeholder={rightPlaceholder}
          choiceSlot={rightChoiceSlot}
          endSlot={rightEndSlot}
          className="h-full"
        />
      </div>
    </div>
  );
}
