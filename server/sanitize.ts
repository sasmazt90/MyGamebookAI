/**
 * Write-time sanitization utilities.
 *
 * We strip HTML tags and common XSS vectors at write-time so stored data is
 * always clean and can be rendered safely without dangerouslySetInnerHTML.
 *
 * No external dependency needed — a focused regex approach is sufficient for
 * plain-text fields (title, name, review comment, bio).  For rich-text fields
 * we would use DOMPurify on the server, but we have none here.
 */

/**
 * Remove all HTML/XML tags and common XSS payloads from a string.
 * Also collapses multiple whitespace runs and trims the result.
 */
export function sanitizeText(value: string): string {
  return value
    // Remove script blocks (with content)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    // Remove style blocks
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities that could re-introduce tags after stripping
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Strip again after entity decode
    .replace(/<[^>]+>/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light sanitize — same as sanitizeText but preserves internal newlines
 * (useful for multi-paragraph description fields).
 */
export function sanitizeRichText(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    // Collapse runs of spaces/tabs but keep newlines
    .replace(/[^\S\n]+/g, " ")
    .trim();
}
