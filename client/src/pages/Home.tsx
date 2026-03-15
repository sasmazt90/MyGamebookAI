import { useState, useEffect, useCallback } from "react";
import { useSEO } from "@/hooks/useSEO";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Sparkles, ChevronLeft, ChevronRight, Star, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookDetailModal } from "@/components/BookDetailModal";

// JSON-LD structured data — serialised ONCE at module level so it is a stable
// string reference and never causes React error #310 (re-render loops).
const HOME_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Gamebook AI",
  "url": typeof window !== "undefined"
    ? window.location.origin
    : (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || "https://example.com",
  "description": "Create, read, and share AI-generated interactive gamebooks with branching stories, vivid illustrations, and memorable characters.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${typeof window !== "undefined"
        ? window.location.origin
        : (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || "https://example.com"}/store?q={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  }
});

// Default hero slides — keys resolved at render time via useLanguage()
const DEFAULT_SLIDE_DEFS = [
  {
    imageUrl: "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?w=1200&q=80",
    headlineKey: "home.hero.slide1.headline" as const,
    subtextKey: "home.hero.slide1.subtext" as const,
    ctaKey: "home.hero.slide1.cta" as const,
    ctaLink: "/create",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=1200&q=80",
    headlineKey: "home.hero.slide2.headline" as const,
    subtextKey: "home.hero.slide2.subtext" as const,
    ctaKey: "home.hero.slide2.cta" as const,
    ctaLink: "/store",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80",
    headlineKey: "home.hero.slide3.headline" as const,
    subtextKey: "home.hero.slide3.subtext" as const,
    ctaKey: "home.hero.slide3.cta" as const,
    ctaLink: "/leaderboard",
  },
];

type SlideData = { imageUrl: string; headline: string; subtext: string; ctaLabel: string; ctaLink: string; };

function HeroSlider({ slides }: { slides: SlideData[] }) {
  const [current, setCurrent] = useState(0);
  const { t } = useLanguage();

  const next = useCallback(() => setCurrent(c => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];

  return (
    <div className="relative h-[400px] md:h-[500px] overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{ backgroundImage: `url(${slide.imageUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0D0B1A]/90 via-[#0D0B1A]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0B1A] via-transparent to-transparent" />

      {/* Content - positioned at bottom-left with padding from edge */}
      <div className="relative z-10 h-full flex items-end">
        <div className="w-full px-10 md:px-16 pb-14 md:pb-16">
          <div className="max-w-xl">
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
              {slide.headline}
            </h1>
            <p className="text-gray-300 text-lg mb-6">{slide.subtext}</p>
            <div className="flex gap-3">
              <Link href={slide.ctaLink}>
                <Button className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold px-6">
                  {slide.ctaLabel}
                </Button>
              </Link>
              <Link href="/store">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 px-6">
                  {t("nav.store")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_: SlideData, i: number) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              i === current ? "bg-[#F59E0B] w-6" : "bg-white/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function BookCard({ book, authorName, authorAvatar, discountedPrice, hasCampaign, onBookClick, onAuthorClick }: {
  book: any;
  authorName?: string | null;
  authorAvatar?: string | null;
  discountedPrice?: number | null;
  hasCampaign?: boolean;
  onBookClick?: (id: number) => void;
  onAuthorClick?: (id: number) => void;
}) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const buyBook = trpc.books.buy.useMutation({
    onSuccess: () => navigate(`/reader/${book.id}`),
  });

  const { data: userLibrary } = trpc.books.myLibrary.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  const isOwned = userLibrary?.some(item => item.book.id === book.id);

  const displayPrice = discountedPrice ?? book.storePrice;

  return (
    <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group cursor-pointer"
      onClick={() => onBookClick?.(book.id)}
    >
      {/* Cover */}
      <div className="relative aspect-[3/4] bg-[#0D0B1A] overflow-hidden">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-purple-700" />
          </div>
        )}
        {hasCampaign && (
          <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">SALE</Badge>
        )}
        {book.category && (
          <Badge className="absolute bottom-2 left-2 bg-[#7C3AED]/80 text-white text-xs">
            {book.category.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">{book.title}</h3>
        <button
          onClick={e => { e.stopPropagation(); onAuthorClick?.(book.authorId); }}
          className="text-xs text-gray-400 hover:text-purple-300 transition-colors mb-2 block text-left"
        >
          {authorName || "Unknown Author"}
        </button>

        {/* Rating */}
        {book.averageRating > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="text-xs text-gray-300">{book.averageRating.toFixed(1)}</span>
            <span className="text-xs text-gray-500">({book.reviewCount})</span>
          </div>
        )}

        {/* Price & Buy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-sm font-bold text-[#F59E0B]">{displayPrice}</span>
            {hasCampaign && book.storePrice !== displayPrice && (
              <span className="text-xs text-gray-500 line-through ml-1">{book.storePrice}</span>
            )}
          </div>

          {isOwned ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-purple-500/50 text-purple-300 h-7"
              onClick={e => { e.stopPropagation(); navigate(`/reader/${book.id}`); }}
            >
              Read
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={e => {
                e.stopPropagation();
                if (!isAuthenticated) {
                  window.location.href = "/login";
                  return;
                }
                buyBook.mutate({ bookId: book.id });
              }}
              disabled={buyBook.isPending}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs h-7"
            >
              {t("store.buy")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsSection() {
  const { t } = useLanguage();
  const stats = [
    { value: "10K+", label: t("home.stats.books"), color: "text-white" },
    { value: "50K+", label: t("home.stats.readers"), color: "text-[#F59E0B]" },
    { value: "2K+", label: t("home.stats.authors"), color: "text-white" },
    { value: "500K+", label: t("home.stats.choices"), color: "text-[#F59E0B]" },
  ];

  return (
    <section className="py-12 bg-[#0D0B1A]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 text-center">
              <p className={cn("text-3xl font-bold mb-1", stat.color)}>{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const { t } = useLanguage();
  const steps = [
    {
      icon: <Sparkles className="w-6 h-6 text-white" />,
      title: t("home.step1.title"),
      desc: t("home.step1.desc"),
      num: "1",
    },
    {
      icon: <BookOpen className="w-6 h-6 text-white" />,
      title: t("home.step2.title"),
      desc: t("home.step2.desc"),
      num: "2",
    },
    {
      icon: <Coins className="w-6 h-6 text-white" />,
      title: t("home.step3.title"),
      desc: t("home.step3.desc"),
      num: "3",
    },
  ];

  return (
    <section className="py-16 bg-[#110D22]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">{t("home.howItWorks.title")}</h2>
          <p className="text-gray-400 max-w-xl mx-auto">{t("home.howItWorks.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 relative">
              {/* Step number */}
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-[#F59E0B] flex items-center justify-center text-black font-bold text-sm">
                {step.num}
              </div>
              {/* Icon */}
              <div className="w-12 h-12 bg-[#7C3AED] rounded-lg flex items-center justify-center mb-4 mt-2">
                {step.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { openBook, openAuthor, modal } = useBookDetailModal();

  // SEO: title, description, canonical URL, and WebSite JSON-LD structured data.
  // HOME_JSONLD is a module-level constant (stable string) — never recreated on render.
  useSEO({
    title: "Gamebook AI — Create AI-Powered Interactive Stories",
    description: "Create, read, and share AI-generated interactive gamebooks with branching stories, vivid illustrations, and memorable characters.",
    canonicalPath: "/",
    jsonLdString: HOME_JSONLD,
  });

  const { data: banners } = trpc.banners.list.useQuery();
  const { data: featuredBooks } = trpc.books.getFeatured.useQuery();

  // Build slides from banners or use defaults
  const { lang } = useLanguage();
  const defaultSlides = DEFAULT_SLIDE_DEFS.map(def => ({
    imageUrl: def.imageUrl,
    headline: t(def.headlineKey),
    subtext: t(def.subtextKey),
    ctaLabel: t(def.ctaKey),
    ctaLink: def.ctaLink,
  }));
  const slides: SlideData[] = banners && banners.length > 0
    ? banners.map(b => {
        const tr = (b.translations as any) || {};
        const loc = tr[lang] || tr["en"] || {};
        return {
          imageUrl: b.imageUrl,
          headline: loc.headline || t("home.hero.slide1.headline"),
          subtext: loc.subtext || "",
          ctaLabel: loc.ctaLabel || t("home.hero.cta.create"),
          ctaLink: b.ctaLink,
        };
      })
    : defaultSlides;

  return (
    <AppLayout>
      {/* Hero Slider */}
      <HeroSlider slides={slides} />

      {/* Featured Gamebooks */}
      <section className="py-12 bg-[#0D0B1A]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">{t("home.featured.title")}</h2>
              <p className="text-sm text-gray-400 mt-1">{t("home.featured.subtitle")}</p>
            </div>
            <Link href="/store">
              <Button variant="outline" className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30 text-sm">
                {t("home.featured.viewAll")}
              </Button>
            </Link>
          </div>

          {!featuredBooks || featuredBooks.length === 0 ? (
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-16 text-center">
              <BookOpen className="w-12 h-12 text-purple-700 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">{t("home.featured.empty")}</p>
              <Link href="/create">
                <Button className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold">
                  {t("home.featured.beFirst")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {featuredBooks.slice(0, 8).map(item => (
                <BookCard
                  key={item.book.id}
                  book={item.book}
                  authorName={item.authorName}
                  authorAvatar={item.authorAvatar}
                  discountedPrice={(item as any).discountedPrice}
                  hasCampaign={(item as any).hasCampaign}
                  onBookClick={openBook}
                  onAuthorClick={openAuthor}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Book/Author Detail Modal */}
      {modal}

      {/* How It Works */}
      <HowItWorksSection />

      {/* Stats */}
      <StatsSection />
    </AppLayout>
  );
}
