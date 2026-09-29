import { isPlayerColor, PLAYER_COLORS, randomAvatar, type PlayerColor } from "@puzzle/shared";

export interface Identity {
  clientId: string;
  name: string;
  color: PlayerColor;
  avatar: string;
}

const KEY = "puzzle:identity";
const CLIENT_KEY = "puzzle:client-id";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Stable per-browser id, created once. Survives renames. */
export function getClientId(): string {
  const store = storage();
  const existing = store?.getItem(CLIENT_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  store?.setItem(CLIENT_KEY, id);
  return id;
}

export function loadIdentity(): Identity | null {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.name !== "string" || !parsed.color || !isPlayerColor(parsed.color))
      return null;
    return {
      clientId: getClientId(),
      name: parsed.name,
      color: parsed.color,
      avatar: typeof parsed.avatar === "string" && parsed.avatar ? parsed.avatar : randomAvatar(),
    };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Omit<Identity, "clientId">): Identity {
  try {
    storage()?.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Private mode or blocked storage: the identity just won't be remembered.
  }
  return { ...identity, clientId: getClientId() };
}

export function randomColor(): PlayerColor {
  return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]!;
}
