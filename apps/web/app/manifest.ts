import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Puzzle",
    description: SITE_DESCRIPTION,
    lang: "uz",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#6c5ce7",
    categories: ["games", "entertainment"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
