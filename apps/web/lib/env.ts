export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

/**
 * Public site origin for canonical URLs, sitemap and link previews:
 * NEXT_PUBLIC_SITE_URL (https://davradosh.uz in production), else Vercel's
 * production domain, else davradosh.uz.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://davradosh.uz")
).replace(/\/+$/, "");
