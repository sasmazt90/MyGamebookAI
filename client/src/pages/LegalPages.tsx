import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

function LegalPageWrapper({ titleKey, children }: { titleKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0]; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 w-fit">
          <ChevronLeft className="w-4 h-4" />
          {t("common.backToHome")}
        </Link>
        <h1 className="text-3xl font-bold text-white mb-6">{t(titleKey)}</h1>
        <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 md:p-8 text-gray-300 space-y-4">
          {children}
        </div>
      </div>
    </AppLayout>
  );
}

export function ImpressumPage() {
  const { t } = useLanguage();
  return (
    <LegalPageWrapper titleKey="legal.impressum">
      <div>
        <h2 className="text-lg font-bold text-white mb-3">{t("legal.impressum.infoTitle")}</h2>
        <p className="font-bold text-white">{t("legal.impressum.company")}</p>
        <p>{t("legal.impressum.address")}</p>
      </div>

      <div>
        <h3 className="font-bold text-white mb-1">{t("legal.impressum.representedBy")}</h3>
        <p className="text-[#A855F7]">TOLGAR SASMAZ</p>
      </div>

      <div>
        <h3 className="font-bold text-white mb-1">{t("legal.impressum.contact")}</h3>
        <p>{t("legal.impressum.email")}</p>
      </div>

      <div>
        <h3 className="font-bold text-white mb-1">{t("legal.impressum.responsible")}</h3>
        <p className="text-[#A855F7]">TOLGAR SASMAZ</p>
        <p>{t("legal.impressum.address")}</p>
      </div>

      <div>
        <h3 className="font-bold text-white mb-2">{t("legal.impressum.disputeTitle")}</h3>
        <p className="text-sm leading-relaxed">
          {t("legal.impressum.disputeText").split("https://ec.europa.eu/consumers/odr")[0]}
          <a href="https://ec.europa.eu/consumers/odr" className="text-[#A855F7] hover:underline" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr
          </a>
          {t("legal.impressum.disputeText").split("https://ec.europa.eu/consumers/odr")[1]}
        </p>
      </div>
    </LegalPageWrapper>
  );
}

export function LegalNoticePage() {
  const { t } = useLanguage();
  return (
    <LegalPageWrapper titleKey="legal.legalNotice">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">{t("legal.notice.title")}</h2>
        <p className="text-sm leading-relaxed">{t("legal.notice.intro")}</p>
      </div>

      {([
        ["legal.notice.s1.title", "legal.notice.s1.text"],
        ["legal.notice.s2.title", "legal.notice.s2.text"],
        ["legal.notice.s3.title", "legal.notice.s3.text"],
        ["legal.notice.s4.title", "legal.notice.s4.text"],
        ["legal.notice.s5.title", "legal.notice.s5.text"],
        ["legal.notice.s6.title", "legal.notice.s6.text"],
        ["legal.notice.s7.title", "legal.notice.s7.text"],
      ] as const).map(([titleKey, textKey]) => (
        <div key={titleKey}>
          <h3 className="font-bold text-white mb-1">{t(titleKey)}</h3>
          <p className="text-sm leading-relaxed">{t(textKey)}</p>
        </div>
      ))}
    </LegalPageWrapper>
  );
}

export function PrivacyPolicyPage() {
  const { t } = useLanguage();
  return (
    <LegalPageWrapper titleKey="legal.privacyPolicy">
      <p className="text-sm">
        <span className="font-bold text-white">{t("legal.privacy.lastUpdated")}</span>{" "}
        <span className="text-[#A855F7]">{t("legal.privacy.lastUpdatedDate")}</span>
      </p>

      {([
        ["legal.privacy.s1.title", "legal.privacy.s1.text"],
        ["legal.privacy.s2.title", "legal.privacy.s2.text"],
        ["legal.privacy.s3.title", "legal.privacy.s3.text"],
        ["legal.privacy.s4.title", "legal.privacy.s4.text"],
        ["legal.privacy.s5.title", "legal.privacy.s5.text"],
        ["legal.privacy.s6.title", "legal.privacy.s6.text"],
      ] as const).map(([titleKey, textKey]) => (
        <div key={titleKey}>
          <h3 className="font-bold text-white mb-1">{t(titleKey)}</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line">{t(textKey)}</p>
        </div>
      ))}
    </LegalPageWrapper>
  );
}

export function CookiePolicyPage() {
  const { t } = useLanguage();
  return (
    <LegalPageWrapper titleKey="legal.cookiePolicy">
      <div>
        <h3 className="font-bold text-white mb-2">{t("legal.cookie.whatTitle")}</h3>
        <p className="text-sm leading-relaxed">{t("legal.cookie.whatText")}</p>
      </div>

      <div>
        <h3 className="font-bold text-white mb-2">{t("legal.cookie.typesTitle")}</h3>
        <p className="text-sm leading-relaxed mb-2">
          <span className="font-bold text-white">{t("legal.cookie.necessary")}</span>{" "}
          {t("legal.cookie.necessaryText")}
        </p>
        <p className="text-sm leading-relaxed mb-2">
          <span className="font-bold text-white">{t("legal.cookie.analytics")}</span>{" "}
          {t("legal.cookie.analyticsText")}
        </p>
        <p className="text-sm leading-relaxed">
          <span className="font-bold text-white">{t("legal.cookie.preference")}</span>{" "}
          {t("legal.cookie.preferenceText")}
        </p>
      </div>

      <div>
        <h3 className="font-bold text-white mb-2">{t("legal.cookie.manageTitle")}</h3>
        <p className="text-sm leading-relaxed">
          {t("legal.cookie.manageText")}{" "}
          <Link href="/cookie-settings" className="text-[#A855F7] hover:underline">
            {t("legal.cookie.manageLink")}
          </Link>{" "}
          page or through your browser settings.
        </p>
      </div>
    </LegalPageWrapper>
  );
}

export function CookieSettingsPage() {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState<{ analytics: boolean; marketing: boolean }>(() => {
    try {
      const raw = localStorage.getItem("cookieConsent") || localStorage.getItem("cookie_prefs");
      const parsed = raw ? JSON.parse(raw) : null;
      return { analytics: parsed?.analytics ?? false, marketing: parsed?.marketing ?? false };
    } catch {
      return { analytics: false, marketing: false };
    }
  });

  const handleSave = () => {
    try {
      const consent = { necessary: true as const, analytics: prefs.analytics, marketing: prefs.marketing, timestamp: Date.now() };
      localStorage.setItem("cookieConsent", JSON.stringify(consent));
      localStorage.removeItem("cookie_prefs");
      toast.success(t("cookieSettings.saved"));
    } catch {
      toast.error(t("cookieSettings.failed"));
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 w-fit">
          <ChevronLeft className="w-4 h-4" />
          {t("common.backToHome")}
        </Link>
        <h1 className="text-3xl font-bold text-white mb-6">{t("cookieSettings.title")}</h1>

        <div className="bg-[#1A1033] border border-purple-900/30 rounded-xl p-6 space-y-4">
          {/* Necessary */}
          <div className="bg-[#0D0B1A] border border-purple-900/30 rounded-lg p-4 flex items-center justify-between">
            <div>
              <Label className="text-white font-semibold">{t("cookieSettings.necessary")}</Label>
              <p className="text-xs text-gray-400 mt-0.5">{t("cookieSettings.necessaryDesc")}</p>
            </div>
            <Switch checked={true} disabled className="data-[state=checked]:bg-[#F59E0B]" />
          </div>

          {/* Analytics */}
          <div className="bg-[#0D0B1A] border border-purple-900/30 rounded-lg p-4 flex items-center justify-between">
            <div>
              <Label className="text-white font-semibold">{t("cookieSettings.analytics")}</Label>
              <p className="text-xs text-gray-400 mt-0.5">{t("cookieSettings.analyticsDesc")}</p>
            </div>
            <Switch
              checked={prefs.analytics}
              onCheckedChange={v => setPrefs(p => ({ ...p, analytics: v }))}
              className="data-[state=checked]:bg-[#7C3AED]"
            />
          </div>

          {/* Marketing */}
          <div className="bg-[#0D0B1A] border border-purple-900/30 rounded-lg p-4 flex items-center justify-between">
            <div>
              <Label className="text-white font-semibold">{t("cookieSettings.marketing")}</Label>
              <p className="text-xs text-gray-400 mt-0.5">{t("cookieSettings.marketingDesc")}</p>
            </div>
            <Switch
              checked={prefs.marketing}
              onCheckedChange={v => setPrefs(p => ({ ...p, marketing: v }))}
              className="data-[state=checked]:bg-[#7C3AED]"
            />
          </div>

          <Button
            onClick={handleSave}
            className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold mt-2"
          >
            {t("cookieSettings.save")}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
