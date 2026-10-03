import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/puzzle`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/mafia`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/puzzle/kunlik`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/shaxmat`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/shashka`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/uno`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/dengiz-jangi`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/mafia/qoidalar`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/create`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/play`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/join`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
