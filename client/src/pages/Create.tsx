import { useState, useRef, useCallback, useEffect } from "react";
import { useSEO } from "@/hooks/useSEO";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, X, Image, Coins, Loader2, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

const BOOK_TYPES = [
  { id: "horror_thriller", labelKey: "category.horror_thriller" },
  { id: "romance", labelKey: "category.romance" },
  { id: "comic", labelKey: "category.comic" },
  { id: "fairy_tale", labelKey: "category.fairy_tale" },
  { id: "crime_mystery", labelKey: "category.crime_mystery" },
  { id: "fantasy_scifi", labelKey: "category.fantasy_scifi" },
] as const;

const BOOK_LENGTHS = [
  { id: "thin", pagesKey: "create.thin.pages" },
  { id: "normal", pagesKey: "create.normal.pages" },
  { id: "thick", pagesKey: "create.thick.pages" },
] as const;

// Which lengths are valid for each genre
const GENRE_LENGTHS: Record<string, string[]> = {
  fairy_tale:      ["thin"],
  comic:           ["thin", "normal"],
  horror_thriller: ["normal", "thick"],
  romance:         ["normal", "thick"],
  crime_mystery:   ["normal", "thick"],
  fantasy_scifi:   ["normal", "thick"],
};

// Exact page counts per category+length — must match the generation spec
const PAGE_COUNT_LABELS: Record<string, Record<string, string>> = {
  fairy_tale:      { thin: "10 pages" },
  comic:           { thin: "10 pages", normal: "18 pages" },
  horror_thriller: { normal: "~80 pages", thick: "~120 pages" },
  romance:         { normal: "~80 pages", thick: "~120 pages" },
  crime_mystery:   { normal: "~80 pages", thick: "~120 pages" },
  fantasy_scifi:   { normal: "~80 pages", thick: "~120 pages" },
};

type Character = {
  id: string;
  name: string;
  photoBase64?: string;
  photoMimeType?: string;
  photoUrl?: string;
  photoPreview?: string;
};

export default function Create() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useSEO({
    title: "Create a Gamebook — AI-Powered Interactive Story Generator",
    description: "Design your own AI-generated interactive gamebook. Choose a genre, add characters with photos, set the length, and let AI write your branching story.",
    canonicalPath: "/create",
  });

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("fairy_tale");
  const [bookLanguage, setBookLanguage] = useState("en");
  const [length, setLength] = useState<string>("thin");

  // Derived: which lengths are valid for the currently selected category
  const allowedLengths = GENRE_LENGTHS[category] ?? ["thin", "normal", "thick"];

  // Auto-correct: if the current length is not allowed for the new genre, pick the first allowed one
  useEffect(() => {
    if (!allowedLengths.includes(length)) {
      setLength(allowedLengths[0]);
    }
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps
  const [description, setDescription] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [safetyChecked, setSafetyChecked] = useState(true);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Credit cost calculation
  const photoCount = characters.filter(c => c.photoBase64 || c.photoUrl).length;
  const { data: costData } = trpc.books.getCreditCost.useQuery({
    category,
    length,
    characterPhotoCount: photoCount,
  });

  const { data: balance } = trpc.credits.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createBook = trpc.books.create.useMutation({
    onSuccess: (_data) => {
      toast.success(t("create.generationStarted" as any) || "Book generation started! Check your library.");
      navigate("/library");
    },
    onError: (err) => {
      if (err.data?.code === "PAYMENT_REQUIRED") {
        toast.error(t("store.insufficientCredits"));
      } else {
        toast.error(err.message || "Failed to create book");
      }
    },
  });

  const addCharacter = () => {
    if (characters.length >= 5) {
      toast.error(t("create.maxCharacters" as any) || "Maximum 5 characters allowed");
      return;
    }
    setCharacters(prev => [...prev, { id: crypto.randomUUID(), name: "" }]);
  };

  const removeCharacter = (id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
  };

  const updateCharacterName = (id: string, name: string) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const updateCharacterPhotoUrl = (id: string, photoUrl: string) => {
    const cleanUrl = photoUrl.trim();
    setCharacters(prev => prev.map(c => c.id === id ? {
      ...c,
      photoUrl: cleanUrl,
      photoBase64: undefined,
      photoMimeType: undefined,
      photoPreview: cleanUrl || undefined,
    } : c));
  };

  const handlePhotoUpload = (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("create.photoTooLarge" as any) || "Photo must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setCharacters(prev => prev.map(c =>
        c.id === id
          ? { ...c, photoBase64: base64, photoMimeType: file.type, photoUrl: undefined, photoPreview: dataUrl }
          : c
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    if (!title.trim()) {
      toast.error(t("create.enterTitle" as any) || "Please enter a book title");
      return;
    }
    if (!safetyChecked) {
      toast.error(t("create.agreeSafety" as any) || "Please agree to the safety guidelines");
      return;
    }

    createBook.mutate({
      title: title.trim(),
      category: category as any,
      length: length as any,
      bookLanguage,
      description,
      characters: characters.filter(c => c.name.trim()).map(c => ({
        name: c.name,
        photoBase64: c.photoBase64,
        photoMimeType: c.photoMimeType,
        photoUrl: c.photoUrl,
      })),
      safetyChecked,
    });
  };

  // Total cost comes from backend (getCreditCost tRPC query) — never hardcoded
  const total = costData?.total ?? 0;
  const hasEnoughCredits = (balance?.balance ?? 0) >= total;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 w-fit">
          <ChevronLeft className="w-4 h-4" />
          {t("common.backToHome")}
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">{t("create.title")}</h1>
        <p className="text-gray-400 mb-8">{t("create.subtitle")}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Book Title */}
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">{t("create.bookTitle")} *</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t("create.titlePlaceholder" as any) || "Enter your book title..."}
                  className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED]"
                  maxLength={255}
                />
              </div>

              {/* Book Type */}
              <div className="space-y-2">
                <Label className="text-gray-300">{t("create.bookType")} *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BOOK_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setCategory(type.id)}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-sm font-medium transition-all border text-center",
                        category === type.id
                          ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                          : "bg-[#0D0B1A] border-purple-900/50 text-gray-300 hover:border-purple-500/50"
                      )}
                    >
                      {t(type.labelKey as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Book Language */}
              <div className="space-y-2">
                <Label className="text-gray-300">{t("create.bookLanguage")}</Label>
                <Select value={bookLanguage} onValueChange={setBookLanguage}>
                  <SelectTrigger className="bg-[#0D0B1A] border-purple-900/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1033] border-purple-900/50 text-white max-h-48">
                    {SUPPORTED_LANGUAGES.map(l => (
                      <SelectItem key={l.code} value={l.code} className="hover:bg-purple-900/30">
                        {l.flag} {l.nativeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Book Length */}
              <div className="space-y-2">
                <Label className="text-gray-300">{t("create.bookLength")} *</Label>
                <div className="flex gap-3">
                  {BOOK_LENGTHS.filter(len => allowedLengths.includes(len.id)).map(len => (
                    <button
                      key={len.id}
                      onClick={() => setLength(len.id)}
                      className={cn(
                        "flex-1 px-3 py-3 rounded-lg text-sm font-medium transition-all border text-center",
                        length === len.id
                          ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                          : "bg-[#0D0B1A] border-purple-900/50 text-gray-300 hover:border-purple-500/50"
                      )}
                    >
                      <div className="font-semibold">{t(`create.${len.id}` as any)}</div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {PAGE_COUNT_LABELS[category]?.[len.id] ?? t(len.pagesKey as any)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Story Description */}
              <div className="space-y-2">
                <Label className="text-gray-300">{t("create.storyDesc")}</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t("create.descPlaceholder" as any) || "Describe your story, characters, setting, and mood..."}
                  className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 focus:border-[#7C3AED] min-h-[120px] resize-none"
                  maxLength={2000}
                />
              </div>
            </div>

            {/* Characters */}
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 space-y-4">
              <Label className="text-gray-300">{t("create.characters")}</Label>

              {characters.map((char, idx) => (
                <div key={char.id} className="bg-[#0D0B1A] border border-purple-900/40 rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <Input
                      value={char.name}
                      onChange={e => updateCharacterName(char.id, e.target.value)}
                      placeholder={`${t("create.characterN" as any) || "Character"} ${idx + 1}`}
                      className="bg-[#1A1033] border-purple-900/50 text-white placeholder:text-gray-600 flex-1"
                    />
                    <button
                      onClick={() => fileInputRefs.current[char.id]?.click()}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors",
                        char.photoBase64
                          ? "bg-[#1A1033] border-green-500/50 text-green-400"
                          : "bg-[#1A1033] border-purple-900/50 text-gray-300 hover:border-purple-500/50"
                      )}
                    >
                      <Image className="w-4 h-4" />
                      {char.photoBase64 ? t("create.photoAdded") : t("create.addPhoto")}
                    </button>
                    <button
                      onClick={() => removeCharacter(char.id)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <input
                      ref={el => { fileInputRefs.current[char.id] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(char.id, file);
                      }}
                    />
                  </div>
                  {char.photoPreview && (
                    <div className="mt-3">
                      <img
                        src={char.photoPreview}
                        alt="Character"
                        className="w-16 h-16 rounded-lg object-cover border border-purple-900/50"
                      />
                    </div>
                  )}
                  <div className="mt-3">
                    <Input
                      value={char.photoUrl ?? ""}
                      onChange={e => updateCharacterPhotoUrl(char.id, e.target.value)}
                      placeholder={t("create.photoUrlPlaceholder" as any) || "Or paste image URL (Google Drive link supported)"}
                      className="bg-[#1A1033] border-purple-900/50 text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={addCharacter}
                className="w-full py-3 border border-dashed border-purple-900/50 rounded-lg text-gray-400 hover:text-white hover:border-purple-500/50 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("create.addCharacter")}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                {t("create.photoCostNote")}
              </p>
            </div>

            {/* Safety Flags */}
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="safety"
                  checked={safetyChecked}
                  onCheckedChange={v => setSafetyChecked(v === true)}
                  className="mt-0.5 border-[#7C3AED] data-[state=checked]:bg-[#7C3AED]"
                />
                <div>
                  <label htmlFor="safety" className="text-sm font-medium text-white cursor-pointer">
                    {t("create.safetyFlags")}
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">{t("create.safetyDesc")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Credit Cost Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 sticky top-20">
              <h3 className="font-semibold text-white mb-4">{t("create.creditCost")}</h3>

              <div className="space-y-3 mb-4">
                {/* Base Cost — always shown, comes from backend pricing.csv */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t("create.baseCost")}</span>
                  <span className="text-white">
                    {costData ? costData.base : <span className="text-gray-500">…</span>} {costData ? t("store.price") : ""}
                  </span>
                </div>
                {/* Character Images — shown only when at least one photo is uploaded */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t("create.photoExtra")}</span>
                  <span className={photoCount > 0 ? "text-[#F59E0B]" : "text-gray-600"}>
                    {photoCount > 0 ? `+${costData?.photoExtra ?? 0}` : "—"} {photoCount > 0 ? t("store.price") : ""}
                  </span>
                </div>
                {/* Total */}
                <div className="border-t border-purple-900/30 pt-3 flex justify-between">
                  <span className="font-semibold text-white">{t("create.total")}</span>
                  <span className="font-bold text-[#F59E0B] text-lg">
                    {costData ? total : "…"} {costData ? t("store.price") : ""}
                  </span>
                </div>
              </div>

              {isAuthenticated && (
                <div className="flex justify-between text-sm mb-6 bg-[#0D0B1A] rounded-lg px-3 py-2">
                  <span className="text-gray-400">{t("create.balance")}</span>
                  <span className={cn("font-semibold", hasEnoughCredits ? "text-green-400" : "text-red-400")}>
                    {balance?.balance ?? 0} {t("store.price")}
                  </span>
                </div>
              )}

              {!hasEnoughCredits && isAuthenticated && (
                <Link href="/credits">
                  <Button variant="outline" className="w-full mb-3 border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/10 text-sm">
                    <Coins className="w-4 h-4 mr-2" />
                    {t("create.buyCredits")}
                  </Button>
                </Link>
              )}

              <Button
                onClick={handleSubmit}
                disabled={createBook.isPending || (!hasEnoughCredits && isAuthenticated)}
                className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold py-3 disabled:opacity-50"
              >
                {createBook.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("create.generating")}</>
                ) : (
                  t("create.generate")
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
