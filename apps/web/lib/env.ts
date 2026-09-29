export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

/**
 * Public site origin for canonical URLs, sitemap and link previews. Set
 * NEXT_PUBLIC_SITE_URL when the final domain is chosen; until then Vercel's
 * production domain (or the current one) is used.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://puzzle.javohir.ru")
).replace(/\/+$/, "");
