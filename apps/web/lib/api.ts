import type { CreateRoomInput, ImageDTO } from "@puzzle/shared";
import { API_URL } from "./env";

export interface RoomPreview {
  id: string;
  code: string | null;
  pieces: number;
  image: ImageDTO;
  status: "PLAYING" | "COMPLETED";
  players: number;
  maxPlayers: number;
  full: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`API ${status}: ${body}`);
  }
}

export interface GalleryItem {
  provider: "unsplash" | "picsum";
  id: string;
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  sourceUrl: string;
}

export const api = {
  createRoom: (input: CreateRoomInput) =>
    request<{ id: string; code: string | null }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getRoom: (id: string) => request<RoomPreview>(`/api/rooms/${encodeURIComponent(id)}`),
  findRoomByCode: (code: string) =>
    // `game` is missing on servers from before mafia tables had codes: those are puzzle rooms.
    request<{ id: string; game?: "puzzle" | "mafia" }>(
      `/api/rooms/code/${encodeURIComponent(code)}`,
    ),
  gallery: (category?: string) =>
    request<{ categories: string[]; items: GalleryItem[] }>(
      `/api/gallery${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),
  importGallery: (item: Pick<GalleryItem, "provider" | "id">) =>
    request<ImageDTO>("/api/gallery/import", {
      method: "POST",
      body: JSON.stringify({ provider: item.provider, id: item.id }),
    }),
  async upload(blob: Blob): Promise<ImageDTO> {
    const form = new FormData();
    form.append("file", blob, blob.type === "image/webp" ? "image.webp" : "image.jpg");
    // No JSON content-type here: the browser sets the multipart boundary.
    const res = await fetch(`${API_URL}/api/uploads`, { method: "POST", body: form });
    if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ""));
    return (await res.json()) as ImageDTO;
  },
};

// ---------------------------------------------------------------- daily puzzle

export interface DailyPuzzleDTO {
  /** Tashkent date, "YYYY-MM-DD". */
  day: string;
  image: ImageDTO;
  seed: number;
  pieces: number;
  /** Until the next puzzle, measured on the server. */
  nextInMs: number;
}

export interface DailyLeaderRow {
  rank: number;
  /** Public player id. */
  id: string;
  name: string;
  color: string;
  avatar: string;
  ms: number;
  you: boolean;
}

export interface DailyLeaderboardDTO {
  day: string;
  total: number;
  top: DailyLeaderRow[];
  you: DailyLeaderRow | null;
}

export interface DailySubmitDTO {
  ok: true;
  day: string;
  /** Best time of the day (may be an earlier, faster one). */
  ms: number;
  improved: boolean;
  rank: number;
  total: number;
}

export const dailyApi = {
  get: () => request<DailyPuzzleDTO>("/api/daily", { cache: "no-store" }),
  start: (clientId: string, day: string) =>
    request<{ day: string; startedAt: number }>("/api/daily/start", {
      method: "POST",
      body: JSON.stringify({ clientId, day }),
    }),
  submit: (input: {
    clientId: string;
    name: string;
    color: string;
    avatar: string;
    ms: number;
    day: string;
  }) =>
    request<DailySubmitDTO>("/api/daily/result", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  leaderboard: (day: string, clientId?: string) =>
    request<DailyLeaderboardDTO>(
      `/api/daily/leaderboard?day=${encodeURIComponent(day)}${
        clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""
      }`,
      { cache: "no-store" },
    ),
};
