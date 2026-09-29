import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/create`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/play`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
