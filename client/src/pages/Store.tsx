import { useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Search,
  Loader2,
  Star,
  Coins,
  ChevronLeft,
  Filter,
  SortAsc,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBookDetailModal } from "@/components/BookDetailModal";

const CATEGORY_KEYS = [
  { id: "all", labelKey: "store.allCategories" },
  { id: "fairy_tale", labelKey: "category.fairy_tale" },
  { id: "comic", labelKey: "store.comicBook" },
  { id: "crime_mystery", labelKey: "store.crimeMysteryCat" },
  { id: "fantasy_scifi", labelKey: "store.fantasySciCat" },
  { id: "romance", labelKey: "store.romanceCat" },
  { id: "horror_thriller", labelKey: "store.horrorCat" },
] as const;

const SORT_KEYS = [
  { id: "newest", labelKey: "store.sortNewest" },
  { id: "popular", labelKey: "store.sortPopular" },
  { id: "price_asc", labelKey: "store.sortPriceLow" },
  { id: "price_desc", labelKey: "store.sortPriceHigh" },
  { id: "rating", labelKey: "store.sortRating" },
] as const;

function BookCard({ item, ownedBookIds, onBookClick, onAuthorClick }: {
  item: any;
  ownedBookIds: number[];
  onBookClick?: (id: number) => void;
  onAuthorClick?: (id: number) => void;
}) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const isOwned = ownedBookIds.includes(item.book.id);
  const displayPrice = item.discountedPrice ?? item.book.storePrice;

  const buyBook = trpc.books.buy.useMutation({
    onSuccess: () => {
      toast.success(`"${item.book.title}" is now in your library. Opening it now...`);
      utils.books.myLibrary.invalidate();
      navigate(`/reader/${item.book.id}`);
    },
    onError: (err) => {
      if (err.data?.code === "PAYMENT_REQUIRED") {
        toast.error(t("store.insufficientCredits"));
      } else {
        toast.error(err.message || t("store.purchaseFailed"));
      }
    },
  });

  return (
    <div
      className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group flex flex-col cursor-pointer"
      onClick={() => onBookClick?.(item.book.id)}
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
              <BookOpen className="w-12 h-12 text-purple-700" />
            </div>
          )}

          {item.hasCampaign && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold">
              SALE
            </Badge>
          )}

          {item.book.category && (
            <Badge className="absolute bottom-2 left-2 bg-[#7C3AED]/80 text-white text-xs">
              {item.book.category.replace("_", " ")}
            </Badge>
          )}
        </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 flex-1 group-hover:text-purple-300 transition-colors">
          {item.book.title}
        </h3>
        <button
          onClick={e => { e.stopPropagation(); item.authorId && onAuthorClick?.(item.authorId); }}
          className="text-xs text-gray-400 hover:text-purple-300 transition-colors mb-2 text-left"
        >
          {item.authorName || t("store.unknownAuthor")}
        </button>

        {/* Rating */}
        {item.book.averageRating > 0 && (
          <div className="flex items-center gap-1 mb-3">
            <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="text-xs text-gray-300">{item.book.averageRating.toFixed(1)}</span>
            <span className="text-xs text-gray-500">({item.book.reviewCount})</span>
          </div>
        )}

        {/* Price & Buy */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-sm font-bold text-[#F59E0B]">{displayPrice}</span>
            {item.hasCampaign && item.book.storePrice !== displayPrice && (
              <span className="text-xs text-gray-500 line-through">{item.book.storePrice}</span>
            )}
          </div>
          {isOwned ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-green-500/50 text-green-400 hover:bg-green-500/10 h-7"
              onClick={e => { e.stopPropagation(); navigate(`/reader/${item.book.id}`); }}
            >
              {t("store.read")}
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
              {buyBook.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("store.buy")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Store() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;
  const { openBook, openAuthor, modal } = useBookDetailModal();

  useSEO({
    title: "Gamebook Store — Browse AI-Generated Interactive Books",
    description: "Browse and discover AI-generated interactive gamebooks. Find branching stories across fantasy, mystery, romance, fairy tale, and more genres.",
    canonicalPath: "/store",
  });

  const { data: books, isLoading } = trpc.books.storeListing.useQuery({
    search: search || undefined,
    category: category === "all" ? undefined : category || undefined,
    limit: LIMIT,
    offset,
  });

  const { data: myLibrary } = trpc.books.myLibrary.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  const ownedBookIds = myLibrary?.map(item => item.book.id) || [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-3 w-fit">
            <ChevronLeft className="w-4 h-4" />
            {t("common.backToHome")}
          </Link>
          <h1 className="text-3xl font-bold text-white">{t("store.title")}</h1>
          <p className="text-gray-400 mt-1">{t("store.subtitle")}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0); }}
              placeholder={t("store.search")}
              className="bg-[#1A1033] border-purple-900/50 text-white pl-9 placeholder:text-gray-600"
            />
          </div>

          <Select value={category} onValueChange={v => { setCategory(v); setOffset(0); }}>
            <SelectTrigger className="bg-[#1A1033] border-purple-900/50 text-white w-48">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder={t("store.categoryFilter")} />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1033] border-purple-900/50 text-white">
              {CATEGORY_KEYS.map(c => (
                <SelectItem key={c.id} value={c.id} className="hover:bg-purple-900/30">
                  {t(c.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="bg-[#1A1033] border-purple-900/50 text-white w-48">
              <SortAsc className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder={t("store.sortBy")} />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1033] border-purple-900/50 text-white">
              {SORT_KEYS.map(s => (
                <SelectItem key={s.id} value={s.id} className="hover:bg-purple-900/30">
                  {t(s.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Books Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : !books || books.length === 0 ? (
          <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-16 text-center">
            <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">{t("store.empty")}</p>
            <Link href="/create">
              <Button className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold">
                {t("store.createBook")}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {books.map(item => (
                <BookCard
                  key={item.book.id}
                  item={item}
                  ownedBookIds={ownedBookIds}
                  onBookClick={openBook}
                  onAuthorClick={openAuthor}
                />
              ))}
            </div>

            {/* Pagination */}
            {(books.length === LIMIT || offset > 0) && (
              <div className="flex justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  disabled={offset === 0}
                  className="border-purple-900/50 text-gray-300 hover:bg-purple-900/30"
                >
                  {t("store.prevPage")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOffset(offset + LIMIT)}
                  disabled={books.length < LIMIT}
                  className="border-purple-900/50 text-gray-300 hover:bg-purple-900/30"
                >
                  {t("store.nextPage")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {modal}
    </AppLayout>
  );
}
