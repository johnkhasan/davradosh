import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.puzzle.javohir.ru" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost", port: "4000" },
    ],
  },
};

export default nextConfig;
