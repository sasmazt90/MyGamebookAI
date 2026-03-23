import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Search,
  Loader2,
  BookMarked,
  RefreshCw,
  Store,
  ChevronLeft,
  Coins,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";

const CATEGORY_FILTER_KEYS = [
  { id: "", labelKey: "library.cat.all" },
  { id: "fairy_tale", labelKey: "library.cat.fairy_tale" },
  { id: "comic", labelKey: "library.cat.comic" },
  { id: "crime_mystery", labelKey: "library.cat.crime_mystery" },
  { id: "fantasy_scifi", labelKey: "library.cat.fantasy_scifi" },
  { id: "romance", labelKey: "library.cat.romance" },
  { id: "horror_thriller", labelKey: "library.cat.horror_thriller" },
] as const;

function GeneratingBookStatus({ step }: { step?: string | null }) {
  const { t } = useLanguage();
  return (
    <div className="text-center px-2">
      <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-2" />
      {step ? (
        <p className="text-xs text-purple-300 font-medium animate-pulse">{step}</p>
      ) : (
        <p className="text-xs text-gray-400">{t("create.generating")}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === "ready") {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
        <CheckCircle className="w-3 h-3 mr-1" /> {t("library.ready" as any) || "Ready"}
      </Badge>
    );
  }
  if (status === "generating") {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t("create.generating")}
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
        <AlertCircle className="w-3 h-3 mr-1" /> {t("library.failed" as any) || "Failed"}
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">
      <Clock className="w-3 h-3 mr-1" /> {t("library.pending")}
    </Badge>
  );
}

function PublishDialog({
  book,
  open,
  onClose,
}: {
  book: any;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [price, setPrice] = useState(5);
  const utils = trpc.useUtils();

  const publishBook = trpc.books.publish.useMutation({
    onSuccess: () => {
      toast.success(t("library.publishedSuccess" as any) || "Book published to store!");
      utils.books.myLibrary.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to publish"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1A1033] border-purple-900/50 text-white">
        <DialogHeader>
          <DialogTitle>{t("library.publishTitle")}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t("library.publishDesc").replace("{title}", book?.title || "")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">{t("library.priceLabel")}</label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={100}
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                className="bg-[#0D0B1A] border-purple-900/50 text-white w-32"
              />
              <span className="text-sm text-gray-400">
                {t("library.youEarn")} <span className="text-green-400">{Math.floor(price * 0.3)} {t("store.price")}</span> (30%)
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {t("library.platformFee")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">{t("common.cancel" as any) || "Cancel"}</Button>
          <Button
            onClick={() => publishBook.mutate({ bookId: book.id, price })}
            disabled={publishBook.isPending}
            className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold"
          >
            {publishBook.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("library.publishBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Library() {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [publishingBook, setPublishingBook] = useState<any>(null);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const deleteBook = trpc.books.deleteBook.useMutation({
    onSuccess: () => {
      toast.success("Book deleted. Purchasers who already own it still have access.");
      utils.books.myLibrary.invalidate();
      setDeletingBookId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete book");
      setDeletingBookId(null);
    },
  });

  const retryGeneration = trpc.books.retryGeneration.useMutation({
    onSuccess: () => {
      toast.success(t("library.regenStarted" as any) || "Regeneration started!");
      utils.books.myLibrary.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to retry generation"),
  });

  // Always call hooks unconditionally (Rules of Hooks)
  const { data: books, isLoading, refetch } = trpc.books.myLibrary.useQuery(
    { search: search || undefined, category: categoryFilter || undefined },
    { enabled: isAuthenticated }
  );
  const publishedBadgeText = (() => {
    const label = t("library.publishedBadge" as any);
    return label && label !== "library.publishedBadge" ? label : "Published";
  })();

  // Auto-refresh for generating books
  useEffect(() => {
    const hasGenerating = books?.some(item => item.book.status === "generating");
    if (!hasGenerating) return;
    const timer = setInterval(() => refetch(), 5000);
    return () => clearInterval(timer);
  }, [books, refetch]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <BookMarked className="w-16 h-16 text-purple-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">{t("library.signInTitle")}</h2>
          <p className="text-gray-400 mb-6">{t("library.signInDesc")}</p>
          <Button
            onClick={() => (window.location.href = "/login")}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
          >
            {t("library.signIn")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-2 w-fit">
              <ChevronLeft className="w-4 h-4" />
              {t("common.backToHome")}
            </Link>
            <h1 className="text-3xl font-bold text-white">{t("library.title")}</h1>
          </div>
          <Link href="/create">
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              {t("library.createBook")}
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("library.search")}
              className="bg-[#1A1033] border-purple-900/50 text-white pl-9 placeholder:text-gray-600"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORY_FILTER_KEYS.map(f => (
              <button
                key={f.id}
                onClick={() => setCategoryFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  categoryFilter === f.id
                    ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                    : "bg-[#1A1033] border-purple-900/50 text-gray-400 hover:text-white"
                )}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Books Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : !books || books.length === 0 ? (
          <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-16 text-center">
            <BookOpen className="w-16 h-16 text-purple-700 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">{t("library.empty")}</p>
            <Link href="/create">
              <Button className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold">
                {t("library.createFirst")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {books.map(item => (
              <div
                key={item.book.id}
                className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
              >
                {/* Cover */}
                <div className="relative aspect-[3/4] bg-[#0D0B1A]">
                  {item.book.coverImageUrl ? (
                    <img
                      src={item.book.coverImageUrl}
                      alt={item.book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {item.book.status === "generating" ? (
                        <GeneratingBookStatus step={item.book.generationStep} />
                      ) : (
                        <BookOpen className="w-12 h-12 text-purple-700" />
                      )}
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    <StatusBadge status={item.book.status} />
                  </div>

                  {/* Published badge */}
                  {item.book.isPublished && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-[#7C3AED]/80 text-white text-xs">
                        <Store className="w-3 h-3 mr-1" /> {publishedBadgeText}
                      </Badge>
                    </div>
                  )}

                  {/* Completed badge */}
                  {(item as any).isCompleted && (
                    <div className="absolute bottom-2 right-2">
                      <Badge className="bg-green-500/90 text-white text-xs font-semibold shadow-lg">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {t("library.completed")}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">{item.book.title}</h3>
                  <p className="text-xs text-gray-400 mb-1">{item.book.category?.replace("_", " ")}</p>

                  {item.book.totalPages && (
                    <p className="text-xs text-gray-500 mb-1">{item.book.totalPages} {t("library.pages")}</p>
                  )}

                  {/* Failed job error message */}
                  {item.book.status === "failed" && (item as any).jobError && (
                    <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400 line-clamp-2">
                        <AlertCircle className="w-3 h-3 inline mr-1 shrink-0" />
                        {(item as any).jobError}
                      </p>
                      {(item as any).jobAttempts >= 3 && (
                        <p className="text-xs text-red-500/70 mt-1">{t("library.maxRetries")}</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {item.book.status === "ready" && (
                      <>
                        <Link href={`/reader/${item.book.id}`} className="flex-1">
                          <Button size="sm" className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs">
                            {t("library.read")}
                          </Button>
                        </Link>
                        {!item.book.isPublished && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPublishingBook(item.book)}
                            className="border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/10 text-xs"
                          >
                            <Store className="w-3 h-3" />
                          </Button>
                        )}
                        {/* Delete button — only shown to the author of this book */}
                        {item.book.authorId === user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Delete book (purchasers keep access)"
                            onClick={() => setDeletingBookId(item.book.id)}
                            className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                    {item.book.status === "generating" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => refetch()}
                        className="w-full text-gray-400 text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> {t("library.refresh")}
                      </Button>
                    )}
                    {item.book.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryGeneration.mutate({ bookId: item.book.id })}
                        disabled={retryGeneration.isPending || (item as any).jobAttempts >= 3}
                        title={(item as any).jobAttempts >= 3 ? "Maximum retry attempts reached" : undefined}
                        className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs disabled:opacity-40"
                      >
                        {retryGeneration.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        {t("library.retryGeneration")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Publish Dialog */}
      {publishingBook && (
        <PublishDialog
          book={publishingBook}
          open={!!publishingBook}
          onClose={() => setPublishingBook(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingBookId} onOpenChange={(open) => { if (!open) setDeletingBookId(null); }}>
        <DialogContent className="bg-[#1A1530] border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Book
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              This will permanently remove the book from the Store and from your Library.
              <br /><br />
              <span className="text-yellow-400 font-medium">Important:</span> Any users who already purchased this book will keep access to it in their own Library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeletingBookId(null)} className="text-gray-400">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteBook.isPending}
              onClick={() => deletingBookId && deleteBook.mutate({ bookId: deletingBookId })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteBook.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
