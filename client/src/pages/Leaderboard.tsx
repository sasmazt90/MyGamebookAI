
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { useBookDetailModal } from "@/components/BookDetailModal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Search,
  Loader2,
  Star,
  Coins,
  Trophy,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Medal,
  Minus,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";

function MonthlyCountdown() {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateCountdown = () => {
      // Berlin timezone (Europe/Berlin)
      const now = new Date();
      const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      
      // Get next month's first day at 00:00 Berlin time
      const nextMonth = new Date(berlinTime.getFullYear(), berlinTime.getMonth() + 1, 1, 0, 0, 0, 0);
      
      const diff = nextMonth.getTime() - berlinTime.getTime();
      
      if (diff > 0) {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-4 flex items-center gap-3">
      <Clock className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-gray-500 mb-1">Next leaderboard reset</p>
        <p className="text-sm font-semibold text-white">
          {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
        </p>
      </div>
    </div>
  );
}

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "fairy_tale", label: "Fairy Tale" },
  { id: "comic", label: "Comic" },
  { id: "crime_mystery", label: "Crime" },
  { id: "fantasy_scifi", label: "Fantasy" },
  { id: "romance", label: "Romance" },
  { id: "horror_thriller", label: "Horror" },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full bg-[#F59E0B] flex items-center justify-center flex-shrink-0">
      <Trophy className="w-3.5 h-3.5 text-black" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
      <Medal className="w-3.5 h-3.5 text-white" />
    </div>
  );
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full bg-[#CD7F32] flex items-center justify-center flex-shrink-0">
      <Medal className="w-3.5 h-3.5 text-white" />
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full bg-[#1A1033] border border-purple-900/50 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-gray-400">{rank}</span>
    </div>
  );
}

function BookRow({
  item,
  rank,
  onBookClick,
  onAuthorClick,
}: {
  item: any;
  rank: number;
  onBookClick: (bookId: number) => void;
  onAuthorClick: (authorId: number) => void;
}) {
  return (
    <div
      className={cn(
        "bg-[#0D0B1A] border rounded-lg p-3 hover:border-purple-500/50 transition-all",
        rank <= 3 ? "border-purple-500/30" : "border-purple-900/20"
      )}
    >
      <div className="flex items-center gap-2">
        <RankBadge rank={rank} />
        {/* Cover */}
        <div className="w-8 h-11 bg-[#1A1033] rounded overflow-hidden flex-shrink-0">
          {item.book.coverImageUrl ? (
            <img src={item.book.coverImageUrl} alt={item.book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-3 h-3 text-purple-700" />
            </div>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onBookClick(item.book.id)}
            className="text-white text-xs font-semibold line-clamp-1 hover:text-purple-300 text-left w-full"
          >
            {item.book.title}
          </button>
          <button
            onClick={() => item.authorId && onAuthorClick(item.authorId)}
            className="text-gray-400 text-xs hover:text-purple-300 text-left truncate block max-w-full"
          >
            {item.authorName || "Unknown"}
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            {item.book.averageRating > 0 && (
              <div className="flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-[#F59E0B] fill-[#F59E0B]" />
                <span className="text-xs text-gray-400">{item.book.averageRating.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-0.5">
              <Coins className="w-2.5 h-2.5 text-[#F59E0B]" />
              <span className="text-xs text-[#F59E0B] font-semibold">{item.book.storePrice}</span>
            </div>
          </div>
        </div>
        {/* Rank change indicator */}
        {item.rankChange !== null && item.rankChange !== undefined && (
          <div className="flex-shrink-0">
            {item.rankChange > 0 ? (
              <div className="flex items-center gap-0.5 text-green-400" title={`Up ${item.rankChange} place${item.rankChange !== 1 ? 's' : ''}`}>
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-bold">{item.rankChange}</span>
              </div>
            ) : item.rankChange < 0 ? (
              <div className="flex items-center gap-0.5 text-red-400" title={`Down ${Math.abs(item.rankChange)} place${Math.abs(item.rankChange) !== 1 ? 's' : ''}`}>
                <TrendingDown className="w-3 h-3" />
                <span className="text-xs font-bold">{Math.abs(item.rankChange)}</span>
              </div>
            ) : (
              <span title="No change"><Minus className="w-3 h-3 text-gray-600" /></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardColumn({
  title,
  icon: Icon,
  items,
  isLoading,
  onBookClick,
  onAuthorClick,
  metaLabel,
  metaKey,
}: {
  title: string;
  icon: React.ElementType;
  items: any[];
  isLoading: boolean;
  onBookClick: (id: number) => void;
  onAuthorClick: (id: number) => void;
  metaLabel: string;
  metaKey: string;
}) {
  return (
    <div className="flex flex-col bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden">
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-900/30 bg-[#150F2A]">
        <Icon className="w-4 h-4 text-[#F59E0B]" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="ml-auto text-xs text-gray-500">{metaLabel}</span>
      </div>

      {/* Rows */}
      <div className="flex-1 p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BookOpen className="w-8 h-8 text-purple-800 mb-2" />
            <p className="text-xs text-gray-500">No books yet</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <BookRow
              key={item.book.id}
              item={item}
              rank={idx + 1}
              onBookClick={onBookClick}
              onAuthorClick={onAuthorClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useSEO({
    title: "Leaderboard — Top-Rated Gamebooks on Gamebook AI",
    description: "Discover the highest-rated and most-read AI-generated interactive gamebooks. See bestsellers, new arrivals, and the most popular branching stories.",
    canonicalPath: "/leaderboard",
  });

  // Navigation via modal
  const { openBook: goToBook, openAuthor: goToAuthor, modal } = useBookDetailModal();

  const { data: leaderboardRaw, isLoading } = trpc.books.leaderboard.useQuery({
    search: search || undefined,
    category: category || undefined,
  });

  const bestSellers = leaderboardRaw?.bestSellers ?? [];
  const newArrivals = leaderboardRaw?.newArrivals ?? [];
  const mostPopular = leaderboardRaw?.mostPopular ?? [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-3 w-fit">
            ← {t("common.backToHome")}
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-7 h-7 text-[#F59E0B]" />
            {t("leaderboard.title")}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Top books ranked by sales, recency, and community reviews</p>
        </div>

        {/* Monthly Countdown */}
        <div className="mb-6">
          <MonthlyCountdown />
        </div>

        {/* Shared Filters */}
        <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or author..."
                className="bg-[#0D0B1A] border-purple-900/50 text-white pl-9 placeholder:text-gray-600"
              />
            </div>
            {/* Category pills */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    category === c.id
                      ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                      : "bg-[#0D0B1A] border-purple-900/50 text-gray-400 hover:text-white"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {(search || category) && (
            <p className="text-xs text-purple-400 mt-2">
              Filters applied — all 3 columns updated
            </p>
          )}
        </div>

        {/* 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LeaderboardColumn
            title="Best Sellers"
            icon={Trophy}
            items={bestSellers}
            isLoading={isLoading}
            onBookClick={goToBook}
            onAuthorClick={goToAuthor}
            metaLabel="by sales"
            metaKey="purchaseCount"
          />
          <LeaderboardColumn
            title="New Arrivals"
            icon={Sparkles}
            items={newArrivals}
            isLoading={isLoading}
            onBookClick={goToBook}
            onAuthorClick={goToAuthor}
            metaLabel="by date"
            metaKey="createdAt"
          />
          <LeaderboardColumn
            title="Most Popular"
            icon={TrendingUp}
            items={mostPopular}
            isLoading={isLoading}
            onBookClick={goToBook}
            onAuthorClick={goToAuthor}
            metaLabel="by reviews"
            metaKey="reviewCount"
          />
        </div>
      </div>
      {modal}
    </AppLayout>
  );
}
