import type { CreateRoomInput, ImageDTO } from "@puzzle/shared";
import { API_URL } from "./env";

export interface RoomPreview {
  id: string;
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

export const api = {
  createRoom: (input: CreateRoomInput) =>
    request<{ id: string }>("/api/rooms", { method: "POST", body: JSON.stringify(input) }),
  getRoom: (id: string) => request<RoomPreview>(`/api/rooms/${encodeURIComponent(id)}`),
};
