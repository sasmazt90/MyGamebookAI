import { useEffect } from "react";

interface SEOOptions {
  /** Page title — should be 30–60 characters */
  title: string;
  /** Meta description — should be 50–160 characters */
  description: string;
  /** Canonical path, e.g. "/" or "/store". Resolved against window.location.origin. */
  canonicalPath?: string;
  /**
   * Optional JSON-LD structured data as a pre-serialised JSON string.
   * Pass a string (not an object) to guarantee referential stability and
   * avoid React error #310 (too-many-re-renders from object identity churn).
   */
  jsonLdString?: string;
}

const CANONICAL_ID = "seo-canonical";
const JSONLD_ID = "seo-jsonld";

/**
 * useSEO — sets document.title, meta description, canonical <link>, and an
 * optional JSON-LD <script> for the current page.
 *
 * All parameters MUST be stable primitives (strings).  Never pass object
 * literals directly — serialise them to a string at module level first.
 */
export function useSEO({ title, description, canonicalPath, jsonLdString }: SEOOptions) {
  // ── Title ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);

  // ── Meta description ─────────────────────────────────────────────────────
  useEffect(() => {
    let el = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !el;
    if (!el) {
      el = document.createElement("meta");
      el.name = "description";
      document.head.appendChild(el);
    }
    const prev = el.getAttribute("content") ?? "";
    el.setAttribute("content", description);
    return () => {
      if (created) {
        el?.remove();
      } else {
        el?.setAttribute("content", prev);
      }
    };
  }, [description]);

  // ── Canonical link ───────────────────────────────────────────────────────
  useEffect(() => {
    if (canonicalPath === undefined) return;
    const href = `${window.location.origin}${canonicalPath}`;
    let el = document.getElementById(CANONICAL_ID) as HTMLLinkElement | null;
    const created = !el;
    if (!el) {
      el = document.createElement("link");
      el.id = CANONICAL_ID;
      el.rel = "canonical";
      document.head.appendChild(el);
    }
    el.href = href;
    return () => {
      if (created) document.getElementById(CANONICAL_ID)?.remove();
    };
  }, [canonicalPath]);

  // ── JSON-LD ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (jsonLdString === undefined) return;
    let el = document.getElementById(JSONLD_ID);
    const created = !el;
    if (!el) {
      el = document.createElement("script");
      el.id = JSONLD_ID;
      (el as HTMLScriptElement).type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = jsonLdString;
    return () => {
      if (created) document.getElementById(JSONLD_ID)?.remove();
    };
  }, [jsonLdString]);
}
