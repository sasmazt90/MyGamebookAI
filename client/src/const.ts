export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns the path to the login page.
 * Custom email/password auth replaces Manus OAuth.
 */
export const getLoginUrl = (_returnPath?: string): string => "/login";
