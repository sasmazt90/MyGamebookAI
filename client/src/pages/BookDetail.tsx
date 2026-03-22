import { useState, useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Star,
  Coins,
  ChevronLeft,
  Loader2,
  User,
  Calendar,
  BookMarked,
  MessageSquare,
  ShoppingCart,
  Check,
  Edit2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Star Rating Widget ───────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [hovered, setHovered] = useState(0);

  const sizeClass = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  }[size];

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hovered || value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={cn(
              "transition-transform",
              !readonly && "cursor-pointer hover:scale-110",
              readonly && "cursor-default"
            )}
          >
            <Star
              className={cn(
                sizeClass,
                "transition-colors",
                filled ? "text-[#F59E0B] fill-[#F59E0B]" : "text-gray-600"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Review Card ─────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: any }) {
  return (
    <div className="bg-[#1A1033] border border-purple-900/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarImage src={review.authorAvatar ?? undefined} />
          <AvatarFallback className="bg-purple-900 text-purple-200 text-xs">
            {(review.authorName ?? "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">
              {review.authorName ?? "Anonymous Reader"}
            </span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(review.review.createdAt), { addSuffix: true })}
            </span>
          </div>
          <StarRating value={review.review.rating} readonly size="sm" />
          {review.review.reviewText && (
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              {review.review.reviewText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rating Distribution Bar ─────────────────────────────────────────────────

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-3 text-right">{star}</span>
      <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
      <div className="flex-1 bg-[#0D0B1A] rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-gray-500 w-4 text-right">{count}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id ?? "0", 10);
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();

  // Review form state
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: book, isLoading: bookLoading } = trpc.books.getDetail.useQuery(
    { id: bookId },
    { enabled: !!bookId }
  );

  const { data: reviewsData, isLoading: reviewsLoading } = trpc.reviews.getForBook.useQuery(
    { bookId },
    { enabled: !!bookId }
  );

  const { data: myReview } = trpc.reviews.myReview.useQuery(
    { bookId },
    { enabled: isAuthenticated && !!bookId }
  );

  const { data: myLibrary } = trpc.books.myLibrary.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  const isOwned = useMemo(
    () => myLibrary?.some(item => item.book.id === bookId) ?? false,
    [myLibrary, bookId]
  );

  // Pre-fill form if user already reviewed
  useState(() => {
    if (myReview) {
      setMyRating(myReview.rating);
      setMyComment(myReview.reviewText ?? "");
    }
  });

  // Mutations
  const buyBook = trpc.books.buy.useMutation({
    onSuccess: () => {
      toast.success(`"${book?.book.title}" is now in your library. Opening it now...`);
      utils.books.myLibrary.invalidate();
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

  const submitReview = trpc.reviews.submit.useMutation({
    onSuccess: () => {
      toast.success(myReview ? "Review updated!" : "Review submitted!");
      utils.reviews.getForBook.invalidate({ bookId });
      utils.reviews.myReview.invalidate({ bookId });
      utils.books.getDetail.invalidate({ id: bookId });
      setIsEditing(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit review");
    },
  });

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsData?.forEach(r => {
      dist[r.review.rating] = (dist[r.review.rating] ?? 0) + 1;
    });
    return dist;
  }, [reviewsData]);

  const totalReviews = reviewsData?.length ?? 0;

  if (bookLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!book) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Book Not Found</h2>
          <p className="text-gray-400 mb-6">This book may have been removed or is not available.</p>
          <Link href="/store">
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Back to Store</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const displayPrice = book.discountedPrice ?? book.book.storePrice ?? 0;
  const categoryLabel = book.book.category?.replace(/_/g, " ") ?? "";

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/store" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 w-fit transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Store
        </Link>

        {/* ── Book Hero Section ── */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 mb-10">
          {/* Cover */}
          <div className="flex flex-col gap-4">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#1A1033] border border-purple-900/30 shadow-2xl shadow-purple-900/20">
              {book.book.coverImageUrl ? (
                <img
                  src={book.book.coverImageUrl}
                  alt={book.book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-purple-700" />
                </div>
              )}
            </div>

            {/* Buy / Read CTA */}
            <div className="space-y-2">
              {isOwned ? (
                <Link href={`/reader/${bookId}`}>
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-base">
                    <BookMarked className="w-5 h-5 mr-2" />
                    Read Now
                  </Button>
                </Link>
              ) : (
                <Button
                  className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold py-3 text-base"
                  onClick={() => {
                    if (!isAuthenticated) {
                      window.location.href = "/login";
                      return;
                    }
                    if (user?.status === "suspended") {
                      toast.error("Your account is suspended. Purchases are disabled.");
                      return;
                    }
                    buyBook.mutate({ bookId });
                  }}
                  disabled={buyBook.isPending || user?.status === "suspended"}
                >
                  {buyBook.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 mr-2" />
                  )}
                  {buyBook.isPending ? "Processing..." : `Buy for ${displayPrice} credits`}
                </Button>
              )}

              {/* Price display */}
              <div className="flex items-center justify-center gap-2">
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
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col gap-4">
            {/* Category badge */}
            {categoryLabel && (
              <Badge className="w-fit bg-[#7C3AED]/20 text-purple-300 border border-purple-700/50 capitalize">
                {categoryLabel}
              </Badge>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              {book.book.title}
            </h1>

            {/* Author */}
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={book.authorAvatar ?? undefined} />
                <AvatarFallback className="bg-purple-900 text-purple-200 text-xs">
                  {(book.authorName ?? "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-gray-300 text-sm">
                by <span className="text-white font-medium">{book.authorName ?? "Unknown Author"}</span>
              </span>
            </div>

            {/* Rating summary */}
            <div className="flex items-center gap-3">
              <StarRating value={Math.round(book.book.averageRating ?? 0)} readonly size="md" />
              <span className="text-white font-semibold">
                {(book.book.averageRating ?? 0).toFixed(1)}
              </span>
              <span className="text-gray-400 text-sm">
                ({book.book.reviewCount ?? 0} {book.book.reviewCount === 1 ? "review" : "reviews"})
              </span>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span>{book.book.totalPages ?? 0} pages</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{new Date(book.book.createdAt).toLocaleDateString()}</span>
              </div>
              {book.book.bookLanguage && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs uppercase font-mono bg-purple-900/30 px-2 py-0.5 rounded text-purple-300">
                    {book.book.bookLanguage}
                  </span>
                </div>
              )}
            </div>

            <Separator className="bg-purple-900/30" />

            {/* Description */}
            {book.book.description && (
              <div>
                <h3 className="text-white font-semibold mb-2">About this Book</h3>
                <p className="text-gray-300 leading-relaxed text-sm">
                  {book.book.description}
                </p>
              </div>
            )}

            {/* Rating distribution */}
            {totalReviews > 0 && (
              <div className="bg-[#1A1033] border border-purple-900/20 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Rating Breakdown</h3>
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map(star => (
                    <RatingBar
                      key={star}
                      star={star}
                      count={ratingDistribution[star] ?? 0}
                      total={totalReviews}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Reviews Section ── */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">
              Reader Reviews
              {totalReviews > 0 && (
                <span className="text-gray-400 font-normal text-base ml-2">({totalReviews})</span>
              )}
            </h2>
          </div>

          {/* ── Write a Review ── */}
          {isAuthenticated && user?.status === "suspended" && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-red-400 text-sm font-medium">
                Your account has been suspended. Reviews and purchases are disabled.
              </p>
            </div>
          )}
          {isAuthenticated && isOwned && user?.status !== "suspended" && (
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-5">
              {myReview && !isEditing ? (
                // Show existing review with edit button
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm">Your Review</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMyRating(myReview.rating);
                        setMyComment(myReview.reviewText ?? "");
                        setIsEditing(true);
                      }}
                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 h-7 text-xs"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                  <StarRating value={myReview.rating} readonly size="md" />
                  {myReview.reviewText && (
                    <p className="text-gray-300 text-sm mt-2">{myReview.reviewText}</p>
                  )}
                </div>
              ) : (
                // Review form
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">
                    {myReview ? "Edit Your Review" : "Write a Review"}
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Your Rating *</label>
                      <StarRating value={myRating} onChange={setMyRating} size="lg" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">
                        Comment <span className="text-gray-600">(optional)</span>
                      </label>
                      <Textarea
                        value={myComment}
                        onChange={e => setMyComment(e.target.value)}
                        placeholder="Share your thoughts about this book..."
                        maxLength={1000}
                        rows={4}
                        className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 resize-none focus:border-purple-500"
                      />
                      <div className="text-right text-xs text-gray-600 mt-1">
                        {myComment.length}/1000
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (myRating === 0) {
                            toast.error("Please select a star rating");
                            return;
                          }
                          submitReview.mutate({
                            bookId,
                            rating: myRating,
                            reviewText: myComment || undefined,
                          });
                        }}
                        disabled={submitReview.isPending || myRating === 0}
                        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                      >
                        {submitReview.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {myReview ? "Update Review" : "Submit Review"}
                      </Button>

                      {myReview && isEditing && (
                        <Button
                          variant="ghost"
                          onClick={() => setIsEditing(false)}
                          className="text-gray-400 hover:text-white hover:bg-purple-900/30"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Not owned — prompt to buy */}
          {isAuthenticated && !isOwned && (
            <div className="bg-[#1A1033] border border-purple-900/20 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">
                Purchase this book to leave a review.
              </p>
            </div>
          )}

          {/* Not logged in */}
          {!isAuthenticated && (
            <div className="bg-[#1A1033] border border-purple-900/20 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">
                <a href="/login" className="text-purple-400 hover:text-purple-300 underline">Sign in</a>{" "}
                and purchase this book to leave a review.
              </p>
            </div>
          )}

          {/* ── Review List ── */}
          {reviewsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : reviewsData && reviewsData.length > 0 ? (
            <div className="space-y-3">
              {reviewsData.map(r => (
                <ReviewCard key={r.review.id} review={r} />
              ))}
            </div>
          ) : (
            <div className="bg-[#1A1033] border border-purple-900/20 rounded-xl p-10 text-center">
              <MessageSquare className="w-10 h-10 text-purple-700 mx-auto mb-3" />
              <p className="text-gray-400">No reviews yet. Be the first to review this book!</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
