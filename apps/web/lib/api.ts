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
    request<{ id: string }>(`/api/rooms/code/${encodeURIComponent(code)}`),
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
