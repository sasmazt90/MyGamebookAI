import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GamebookLogo } from "@/components/AppLayout";
import { CheckCircle, XCircle, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [authorName, setAuthorName] = useState("");
  const [debouncedName, setDebouncedName] = useState("");

  // Debounce the author name check
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(authorName), 500);
    return () => clearTimeout(timer);
  }, [authorName]);

  const { data: checkData, isLoading: isChecking } = trpc.profile.checkAuthorName.useQuery(
    { authorName: debouncedName },
    {
      enabled: debouncedName.length >= 3,
    }
  );

  const createProfile = trpc.profile.create.useMutation({
    onSuccess: () => {
      toast.success("Welcome to Gamebook AI!");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create profile");
    },
  });

  const isValid = authorName.length >= 3 && /^[a-zA-Z0-9 ._-]+$/.test(authorName);
  const isAvailable = checkData?.available === true;
  const showStatus = debouncedName.length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !isAvailable) return;
    createProfile.mutate({ authorName });
  };

  return (
    <div className="min-h-screen bg-[#0D0B1A] flex flex-col items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-purple-900/10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <GamebookLogo size="lg" />
        </div>

        {/* Card */}
        <div className="bg-[#1A1033] border border-purple-900/40 rounded-2xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#7C3AED]/20 rounded-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-[#A855F7]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {t("onboarding.title")}
          </h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            {t("onboarding.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">{t("onboarding.authorName")}</Label>
              <div className="relative">
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. TolgarSasmaz"
                  className="bg-[#0D0B1A] border-purple-900/50 text-white placeholder:text-gray-600 pr-10 focus:border-[#7C3AED]"
                  maxLength={30}
                />
                {showStatus && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isChecking ? (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    ) : isAvailable ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                )}
              </div>

              {/* Status message */}
              {showStatus && !isChecking && (
                <p className={`text-xs ${isAvailable ? "text-green-400" : "text-red-400"}`}>
                  {isAvailable ? t("onboarding.available") : t("onboarding.taken")}
                </p>
              )}

              <p className="text-xs text-gray-500">{t("onboarding.authorNameHint")}</p>
            </div>

            <Button
              type="submit"
              disabled={!isValid || !isAvailable || createProfile.isPending}
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold py-3 text-base disabled:opacity-50"
            >
              {createProfile.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                t("onboarding.continue")
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
