/**
 * BookDetailModal — single modal with an internal navigation stack.
 *
 * Supports two view types:
 *   - "book"   → shows book detail (cover, info, reviews, buy CTA)
 *   - "author" → shows author profile + their published books
 *
 * Navigation stack allows Back button to return to the previous view
 * (Book ↔ Author) without closing the modal or losing context.
 *
 * Usage:
 *   <BookDetailModal bookId={5} onClose={() => setOpen(false)} />
 *   <BookDetailModal authorId={12} onClose={() => setOpen(false)} />
 */

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  ChevronLeft,
  Star,
  Coins,
  ShoppingCart,
  BookMarked,
  Loader2,
  User,
  Calendar,
  MessageSquare,
  ExternalLink,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StackEntry =
  | { type: "book"; id: number }
  | { type: "author"; id: number };

// ─── Star Rating (read-only mini) ─────────────────────────────────────────────

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i < Math.round(value) ? "text-[#F59E0B] fill-[#F59E0B]" : "text-gray-600"
          )}
        />
      ))}
    </div>
  );
}

// ─── Book View ────────────────────────────────────────────────────────────────

function BookView({
  bookId,
  onAuthorClick,
  onClose,
}: {
  bookId: number;
  onAuthorClick: (authorId: number) => void;
  onClose: () => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: book, isLoading } = trpc.books.getDetail.useQuery({ id: bookId });
  const { data: reviewsData } = trpc.reviews.getForBook.useQuery({ bookId });
  const { data: myLibrary } = trpc.books.myLibrary.useQuery({}, { enabled: isAuthenticated });

  const isOwned = useMemo(
    () => myLibrary?.some(item => item.book.id === bookId) ?? false,
    [myLibrary, bookId]
  );

  const buyBook = trpc.books.buy.useMutation({
    onSuccess: () => {
      toast.success(`"${book?.book.title}" added to your library!`);
      utils.books.myLibrary.invalidate();
      onClose();
      navigate(`/reader/${bookId}`);
    },
    onError: (err) => {
      if (err.data?.code === "PAYMENT_REQUIRED") {
        toast.error("Insufficient credits. Please buy more credits.");
      } else {
        toast.error(err.message || "Purchase failed");
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 text-purple-700 mx-auto mb-3" />
        <p className="text-gray-400">Book not found.</p>
      </div>
    );
  }

  const displayPrice = book.discountedPrice ?? book.book.storePrice ?? 0;
  const categoryLabel = book.book.category?.replace(/_/g, " ") ?? "";
  const totalReviews = reviewsData?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex gap-5">
        {/* Cover */}
        <div className="w-28 flex-shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-[#1A1033] border border-purple-900/30 shadow-xl">
          {book.book.coverImageUrl ? (
            <img src={book.book.coverImageUrl} alt={book.book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-purple-700" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          {categoryLabel && (
            <Badge className="bg-[#7C3AED]/20 text-purple-300 border border-purple-700/50 capitalize text-xs">
              {categoryLabel}
            </Badge>
          )}
          <h2 className="text-xl font-bold text-white leading-tight line-clamp-3">{book.book.title}</h2>

          {/* Author clickable */}
          <button
            onClick={() => book.authorId && onAuthorClick(book.authorId)}
            className="flex items-center gap-2 group"
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={book.authorAvatar ?? undefined} />
              <AvatarFallback className="bg-purple-900 text-purple-200 text-xs">
                {(book.authorName ?? "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-400 group-hover:text-purple-300 transition-colors">
              by <span className="text-gray-300 font-medium">{book.authorName ?? "Unknown Author"}</span>
            </span>
          </button>

          {/* Rating */}
          {(book.book.averageRating ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <Stars value={book.book.averageRating ?? 0} />
              <span className="text-white text-sm font-semibold">{(book.book.averageRating ?? 0).toFixed(1)}</span>
              <span className="text-gray-500 text-xs">({totalReviews})</span>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {book.book.totalPages ?? 0} pages
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(book.book.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {book.book.description && (
        <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">{book.book.description}</p>
      )}

      {/* Price + CTA */}
      {book.book.storePrice !== null && (
        <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[#F59E0B] font-bold text-lg">{displayPrice}</span>
            {book.hasCampaign && book.book.storePrice !== displayPrice && (
              <>
                <span className="text-gray-500 line-through text-sm">{book.book.storePrice}</span>
                <Badge className="bg-red-500 text-white text-xs">SALE</Badge>
              </>
            )}
            <span className="text-gray-400 text-sm">credits</span>
          </div>

          {user?.status === "suspended" ? (
            <p className="text-red-400 text-sm">Your account is suspended. Purchases are disabled.</p>
          ) : isOwned ? (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { onClose(); navigate(`/reader/${bookId}`); }}
            >
              <BookMarked className="w-4 h-4 mr-2" />
              Read Now
            </Button>
          ) : (
            <Button
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold"
              onClick={() => {
                if (!isAuthenticated) {
                  window.location.href = "/login";
                  return;
                }
                buyBook.mutate({ bookId });
              }}
              disabled={buyBook.isPending}
            >
              {buyBook.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4 mr-2" />
              )}
              {buyBook.isPending ? "Processing..." : `Buy for ${displayPrice} credits`}
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full border-purple-700/50 text-purple-300 hover:bg-purple-900/20"
            onClick={() => { onClose(); navigate(`/store/${bookId}`); }}
          >
            View Full Detail Page
          </Button>
        </div>
      )}

      {/* Recent Reviews */}
      {reviewsData && reviewsData.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">
              Reader Reviews <span className="text-gray-500 font-normal">({totalReviews})</span>
            </h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {reviewsData.slice(0, 5).map(r => (
              <div key={r.review.id} className="bg-[#0D0B1A] rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-medium">{r.authorName ?? "Reader"}</span>
                  <Stars value={r.review.rating} />
                </div>
                {r.review.reviewText && (
                  <p className="text-gray-400 line-clamp-2">{r.review.reviewText}</p>
                )}
                <p className="text-gray-600">{formatDistanceToNow(new Date(r.review.createdAt), { addSuffix: true })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report button — only for authenticated non-authors */}
      {isAuthenticated && book.authorId !== user?.id && (
        <ReportButton bookId={bookId} />
      )}
    </div>
  );
}

// ─── Report Button ────────────────────────────────────────────────────────────

function ReportButton({ bookId }: { bookId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const report = trpc.moderation.reportBook.useMutation({
    onSuccess: () => {
      toast.success("Report submitted. Our team will review it.");
      setOpen(false);
      setReason("");
    },
    onError: (err) => toast.error(err.message || "Failed to submit report"),
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors mt-1"
      >
        <Flag className="w-3 h-3" /> Report this book
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1A1033] border border-purple-900/50 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold">Report Book</h3>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe the issue (e.g. inappropriate content, spam...)"
              rows={4}
              maxLength={255}
              className="w-full bg-[#0D0B1A] border border-purple-900/50 rounded-lg p-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-gray-400 hover:text-white px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={() => report.mutate({ bookId, reason })}
                disabled={reason.trim().length < 5 || report.isPending}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors"
              >
                {report.isPending ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Author View ──────────────────────────────────────────────────────────────

function AuthorView({
  authorId,
  onBookClick,
}: {
  authorId: number;
  onBookClick: (bookId: number) => void;
}) {
  const { data: authorProfile, isLoading: profileLoading } = trpc.books.getAuthorProfile.useQuery({ userId: authorId });
  const { data: authorBooks, isLoading: booksLoading } = trpc.books.authorBooks.useQuery({ userId: authorId });

  const isLoading = profileLoading || booksLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!authorProfile) {
    return (
      <div className="text-center py-16">
        <User className="w-12 h-12 text-purple-700 mx-auto mb-3" />
        <p className="text-gray-400">Author not found.</p>
      </div>
    );
  }

  const profile = authorProfile.profile;

  return (
    <div className="space-y-5">
      {/* Author Hero */}
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16 border-2 border-purple-700/50">
          <AvatarImage src={profile.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-purple-900 text-purple-200 text-xl font-bold">
            {(profile.authorName ?? "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-bold text-white">{profile.authorName}</h2>
          <p className="text-sm text-gray-400">
            {authorBooks?.length ?? 0} published {authorBooks?.length === 1 ? "book" : "books"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Separator className="bg-purple-900/30" />

      {/* Standalone profile link */}
      <a
        href={`/author/${authorId}`}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-purple-700/40 text-purple-300 hover:bg-purple-900/20 text-sm transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View Full Profile Page
      </a>

      {/* Author's Books */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Books by {profile.authorName}
        </h3>
        {!authorBooks || authorBooks.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-8 h-8 text-purple-800 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No published books yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {authorBooks.map(item => (
              <button
                key={item.book.id}
                onClick={() => onBookClick(item.book.id)}
                className="w-full flex items-center gap-3 bg-[#0D0B1A] border border-purple-900/20 rounded-lg p-3 hover:border-purple-500/50 transition-all text-left group"
              >
                {/* Mini cover */}
                <div className="w-10 h-14 bg-[#1A1033] rounded overflow-hidden flex-shrink-0">
                  {item.book.coverImageUrl ? (
                    <img src={item.book.coverImageUrl} alt={item.book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-purple-700" />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium line-clamp-2 group-hover:text-purple-300 transition-colors">
                    {item.book.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {(item.book.averageRating ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-[#F59E0B] fill-[#F59E0B]" />
                        <span className="text-xs text-gray-400">{(item.book.averageRating ?? 0).toFixed(1)}</span>
                      </div>
                    )}
                    {item.book.storePrice !== null && (
                      <div className="flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5 text-[#F59E0B]" />
                        <span className="text-xs text-[#F59E0B] font-semibold">{item.book.storePrice}</span>
                      </div>
                    )}
                    {item.book.category && (
                      <span className="text-xs text-gray-600 capitalize">{item.book.category.replace("_", " ")}</span>
                    )}
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-gray-600 rotate-180 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface BookDetailModalProps {
  /** Open with a specific book */
  bookId?: number;
  /** Open with a specific author */
  authorId?: number;
  onClose: () => void;
}

export function BookDetailModal({ bookId, authorId, onClose }: BookDetailModalProps) {
  // Navigation stack — starts with the initial entry
  const [stack, setStack] = useState<StackEntry[]>(() => {
    if (bookId != null) return [{ type: "book", id: bookId }];
    if (authorId != null) return [{ type: "author", id: authorId }];
    return [];
  });

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  const pushBook = useCallback((id: number) => {
    setStack(prev => [...prev, { type: "book", id }]);
  }, []);

  const pushAuthor = useCallback((id: number) => {
    setStack(prev => [...prev, { type: "author", id }]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  if (!current) return null;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="bg-[#0D0B1A] border border-purple-900/40 text-white max-w-lg w-full max-h-[90vh] overflow-y-auto p-0">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-purple-900/30 sticky top-0 bg-[#0D0B1A] z-10">
          {canGoBack ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div className="w-12" />
          )}
          <div className="flex-1 text-center">
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {current.type === "book" ? "Book Detail" : "Author Profile"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          {current.type === "book" ? (
            <BookView
              bookId={current.id}
              onAuthorClick={pushAuthor}
              onClose={onClose}
            />
          ) : (
            <AuthorView
              authorId={current.id}
              onBookClick={pushBook}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hook for easy usage ──────────────────────────────────────────────────────

export function useBookDetailModal() {
  const [state, setState] = useState<{ bookId?: number; authorId?: number } | null>(null);

  const openBook = useCallback((bookId: number) => setState({ bookId }), []);
  const openAuthor = useCallback((authorId: number) => setState({ authorId }), []);
  const close = useCallback(() => setState(null), []);

  const modal = state ? (
    <BookDetailModal
      bookId={state.bookId}
      authorId={state.authorId}
      onClose={close}
    />
  ) : null;

  return { openBook, openAuthor, close, modal };
}
