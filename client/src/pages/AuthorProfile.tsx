import { useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useBookDetailModal } from "@/components/BookDetailModal";
import { toast } from "sonner";
import {
  BookOpen,
  Star,
  Coins,
  ChevronLeft,
  Share2,
  Copy,
  Check,
  Loader2,
  ShoppingBag,
  MessageSquare,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-4 flex flex-col items-center text-center gap-1">
      <Icon className={cn("w-5 h-5 mb-1", color)} />
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ─── Book Card ────────────────────────────────────────────────────────────────

function BookCard({
  item,
  ownedBookIds,
  onBookClick,
}: {
  item: any;
  ownedBookIds: number[];
  onBookClick: (id: number) => void;
}) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const isOwned = ownedBookIds.includes(item.book.id);
  const displayPrice = item.book.storePrice ?? 0;

  const buyBook = trpc.books.buy.useMutation({
    onSuccess: () => {
      toast.success(`"${item.book.title}" added to your library!`);
      utils.books.myLibrary.invalidate();
      navigate(`/reader/${item.book.id}`);
    },
    onError: (err) => {
      if (err.data?.code === "PAYMENT_REQUIRED") {
        toast.error("Insufficient credits. Please buy more.");
      } else {
        toast.error(err.message || "Purchase failed");
      }
    },
  });

  return (
    <div
      className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group cursor-pointer flex flex-col"
      onClick={() => onBookClick(item.book.id)}
    >
        {/* Cover */}
      <div className="relative aspect-[3/4] bg-[#0D0B1A] overflow-hidden flex-shrink-0">
        {item.book.coverImageUrl ? (
          <img
            src={item.book.coverImageUrl}
            alt={item.book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-purple-700" />
          </div>
        )}
        {item.book.category && (
          <Badge className="absolute bottom-2 left-2 bg-[#7C3AED]/80 text-white text-xs capitalize">
            {item.book.category.replace(/_/g, " ")}
          </Badge>
        )}
        {/* Completion count badge */}
        {(item.completedReaders ?? 0) > 0 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-600/90 text-white text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {item.completedReaders}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 group-hover:text-purple-300 transition-colors">
          {item.book.title}
        </h3>

        {/* Rating */}
        {(item.book.averageRating ?? 0) > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="text-xs text-gray-300">{(item.book.averageRating ?? 0).toFixed(1)}</span>
            <span className="text-xs text-gray-500">({item.book.reviewCount})</span>
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-[#F59E0B]" />
            <span className="text-sm font-bold text-[#F59E0B]">{displayPrice}</span>
          </div>

          {isOwned ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-green-500/50 text-green-400 hover:bg-green-500/10 h-7"
              onClick={e => { e.stopPropagation(); navigate(`/reader/${item.book.id}`); }}
            >
              Read
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs h-7"
              onClick={e => {
                e.stopPropagation();
                if (!isAuthenticated) {
                  window.location.href = "/login";
                  return;
                }
                buyBook.mutate({ bookId: item.book.id });
              }}
              disabled={buyBook.isPending}
            >
              {buyBook.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buy"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Share Button ─────────────────────────────────────────────────────────────

function ShareButton({ authorId }: { authorId: number }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/author/${authorId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Profile link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard API
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      toast.success("Profile link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    }
  }, [authorId]);

  return (
    <Button
      variant="outline"
      className="border-purple-700/50 text-purple-300 hover:bg-purple-900/20 gap-2"
      onClick={handleShare}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-400" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share Profile
        </>
      )}
    </Button>
  );
}

// ─── Category Filter ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "fairy_tale", label: "Fairy Tale" },
  { id: "comic", label: "Comic" },
  { id: "crime_mystery", label: "Crime" },
  { id: "fantasy_scifi", label: "Fantasy" },
  { id: "romance", label: "Romance" },
  { id: "horror_thriller", label: "Horror" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuthorProfile() {
  const { id } = useParams<{ id: string }>();
  const authorId = parseInt(id ?? "0", 10);
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState("");

  const { openBook, modal } = useBookDetailModal();

  const { data: authorData, isLoading: profileLoading } = trpc.books.getAuthorProfile.useQuery(
    { userId: authorId },
    { enabled: !!authorId && !isNaN(authorId) }
  );

  const { data: authorBooks, isLoading: booksLoading } = trpc.books.authorBooks.useQuery(
    { userId: authorId },
    { enabled: !!authorId && !isNaN(authorId) }
  );

  const { data: myLibrary } = trpc.books.myLibrary.useQuery({}, { enabled: isAuthenticated });
  const ownedBookIds = myLibrary?.map(item => item.book.id) ?? [];

  const filteredBooks = (authorBooks ?? []).filter(item =>
    !categoryFilter || item.book.category === categoryFilter
  );

  const isLoading = profileLoading || booksLoading;

  if (isNaN(authorId) || authorId <= 0) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Invalid author ID.</p>
          <Link href="/store">
            <Button className="mt-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Browse Store</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!authorData) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Author not found.</p>
          <Link href="/store">
            <Button className="mt-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Browse Store</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const profile = authorData.profile;
  const stats = authorData.stats;
  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back nav */}
        <Link href="/store" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 w-fit transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Store
        </Link>

        {/* ── Hero Card ── */}
        <div className="bg-[#1A1033] border border-purple-900/30 rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <Avatar className="w-24 h-24 border-4 border-purple-700/50 flex-shrink-0">
              <AvatarImage src={profile.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-[#7C3AED] text-white text-3xl font-bold">
                {(profile.authorName ?? "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{profile.authorName}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Calendar className="w-3.5 h-3.5" />
                Member since {memberSince}
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-lg">
                {stats.totalBooks > 0
                  ? `${profile.authorName} has published ${stats.totalBooks} interactive ${stats.totalBooks === 1 ? "gamebook" : "gamebooks"} on Gamebook AI.`
                  : `${profile.authorName} hasn't published any gamebooks yet.`}
              </p>
            </div>

            {/* Share button */}
            <div className="flex-shrink-0">
              <ShareButton authorId={authorId} />
            </div>
          </div>

          {/* Stats row */}
          {stats.totalBooks > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
              <StatCard
                icon={BookOpen}
                label="Books"
                value={stats.totalBooks}
                color="text-purple-400"
              />
              <StatCard
                icon={ShoppingBag}
                label="Total Sales"
                value={stats.totalSales}
                color="text-[#F59E0B]"
              />
              <StatCard
                icon={CheckCircle2}
                label="Completions"
                value={(stats as any).totalCompletions ?? 0}
                color="text-green-400"
              />
              <StatCard
                icon={MessageSquare}
                label="Reviews"
                value={stats.totalReviews}
                color="text-blue-400"
              />
              <StatCard
                icon={Star}
                label="Avg Rating"
                value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
                color="text-[#F59E0B]"
              />
            </div>
          )}
        </div>

        {/* ── Book Catalogue ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-white">
                Published Books
                {filteredBooks.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({filteredBooks.length})</span>
                )}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">All interactive gamebooks by {profile.authorName}</p>
            </div>

            {/* Category filter pills */}
            {(authorBooks?.length ?? 0) > 1 && (
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
                      categoryFilter === c.id
                        ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                        : "bg-[#0D0B1A] border-purple-900/50 text-gray-400 hover:text-white"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredBooks.length === 0 ? (
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-16 text-center">
              <BookOpen className="w-12 h-12 text-purple-700 mx-auto mb-3" />
              <p className="text-gray-400">
                {categoryFilter
                  ? "No books in this category yet."
                  : `${profile.authorName} hasn't published any books yet.`}
              </p>
              {categoryFilter && (
                <Button
                  variant="outline"
                  className="mt-4 border-purple-700/50 text-purple-300"
                  onClick={() => setCategoryFilter("")}
                >
                  Clear filter
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredBooks.map(item => (
                <BookCard
                  key={item.book.id}
                  item={item}
                  ownedBookIds={ownedBookIds}
                  onBookClick={openBook}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Book detail modal */}
      {modal}
    </AppLayout>
  );
}
