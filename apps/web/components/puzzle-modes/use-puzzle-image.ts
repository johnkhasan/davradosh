"use client";

import { useEffect, useState } from "react";
import { loadRoomImage, type PuzzleImage } from "@/lib/game/images";

export interface RemoteImage {
  url: string;
  width: number;
  height: number;
}

/**
 * Loads a server image (CORS-readable) at exactly its stored size, so every player cuts
 * identical pieces. `image` is null while loading; `failed` when it could not be read.
 */
export function usePuzzleImage(source: RemoteImage | null) {
  const [loaded, setLoaded] = useState<{
    url: string;
    image: PuzzleImage | null;
    failed: boolean;
  } | null>(null);
  const url = source?.url ?? null;
  const width = source?.width ?? 0;
  const height = source?.height ?? 0;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadRoomImage({ source: "upload", url, width, height }, 0)
      .then((image) => !cancelled && setLoaded({ url, image, failed: false }))
      .catch(() => !cancelled && setLoaded({ url, image: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [url, width, height]);

  const current = loaded && loaded.url === url ? loaded : null;
  return { image: current?.image ?? null, failed: current?.failed ?? false };
}
