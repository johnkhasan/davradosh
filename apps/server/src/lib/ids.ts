import { createHash, randomBytes, randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** URL-safe random id without look-alike characters (no l, I, O). */
export function randomId(length = 8): string {
  const bytes = randomBytes(length * 2);
  let id = "";
  for (let i = 0; id.length < length && i < bytes.length; i++) {
    const byte = bytes[i]!;
    // Rejection sampling keeps the distribution uniform.
    if (byte < 256 - (256 % ALPHABET.length)) id += ALPHABET[byte % ALPHABET.length];
  }
  return id.length === length ? id : randomId(length);
}

/** 4-digit room join code, "0000".."9999". */
export function randomCode(): string {
  return randomInt(0, 10_000).toString().padStart(4, "0");
}

/**
 * Public player id derived from the private client id. Other players only ever
 * see this value, so knowing it does not let anyone join (or get voice tokens)
 * as someone else.
 */
export function publicPlayerId(clientId: string): string {
  return createHash("sha256").update(`player:${clientId}`).digest("base64url").slice(0, 16);
}
