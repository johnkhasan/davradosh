import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// Room pages stay crawlable so link-preview bots can read them; they opt out of indexing with a noindex meta tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
