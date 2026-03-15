import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getStoredConsent,
  acceptAllConsent,
  rejectNonEssentialConsent,
  type CookieConsent,
} from "@/hooks/useCookieConsent";

interface CookieConsentBannerProps {
  onConsentChange?: (consent: CookieConsent) => void;
}

export function CookieConsentBanner({ onConsentChange }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if no consent has been stored yet
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    const consent = acceptAllConsent();
    onConsentChange?.(consent);
    setVisible(false);
  };

  const handleRejectNonEssential = () => {
    const consent = rejectNonEssentialConsent();
    onConsentChange?.(consent);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-4xl mx-auto bg-[#1A1033] border border-purple-700/50 rounded-xl shadow-2xl shadow-purple-900/30 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
        {/* Icon + text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Cookie className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300 leading-relaxed">
            We use cookies to improve your experience. Necessary cookies are always active.{" "}
            <Link
              href="/cookie-settings"
              className="text-[#A855F7] hover:underline whitespace-nowrap"
            >
              Manage Preferences
            </Link>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRejectNonEssential}
            className="border-purple-700/50 text-gray-300 hover:text-white hover:border-purple-500 bg-transparent text-xs"
          >
            Reject Non-Essential
          </Button>
          <Button
            size="sm"
            onClick={handleAcceptAll}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs"
          >
            Accept All
          </Button>
          <Link href="/cookie-settings">
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white text-xs px-2"
              onClick={() => setVisible(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
