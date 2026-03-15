/**
 * useCookieConsent
 * Manages cookie consent preferences stored in localStorage.
 * Key: "cookieConsent"
 * Shape: { necessary: true, analytics: boolean, marketing: boolean, timestamp: number }
 */

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const STORAGE_KEY = "cookieConsent";

export function getStoredConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    // Validate shape
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(prefs: Omit<CookieConsent, "necessary" | "timestamp">): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Storage unavailable — fail silently
  }
  return consent;
}

export function acceptAllConsent(): CookieConsent {
  return saveConsent({ analytics: true, marketing: true });
}

export function rejectNonEssentialConsent(): CookieConsent {
  return saveConsent({ analytics: false, marketing: false });
}

/**
 * Script gating helper.
 * Call this before loading any analytics or marketing script.
 */
export function isAnalyticsAllowed(): boolean {
  const consent = getStoredConsent();
  return consent?.analytics === true;
}

export function isMarketingAllowed(): boolean {
  const consent = getStoredConsent();
  return consent?.marketing === true;
}
