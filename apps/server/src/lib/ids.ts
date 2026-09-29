import { randomBytes } from "node:crypto";

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
