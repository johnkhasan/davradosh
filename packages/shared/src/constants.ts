/** Hard limit of simultaneous players in one puzzle room. Enforced on the server. */
export const MAX_PLAYERS_PER_ROOM = 5;
export const MIN_PLAYERS_PER_ROOM = 2;

/** Piece counts offered in the create wizard. */
export const PIECE_COUNT_OPTIONS = [24, 48, 100, 200, 500] as const;
export type PieceCountOption = (typeof PIECE_COUNT_OPTIONS)[number];

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 20;

/** Rooms are deleted this long after creation. */
export const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Client-side throttle for cursor and drag updates. */
export const CURSOR_SEND_INTERVAL_MS = 40;

/** A group lock expires if the holder sends no updates for this long. */
export const LOCK_TIMEOUT_MS = 10_000;

/** A disconnected player's seat stays reserved for this long. */
export const SEAT_RESERVATION_MS = 30_000;

/** Max distance (as a fraction of piece size) at which two neighbours snap together. */
export const SNAP_TOLERANCE = 0.15;
