export const REGION = 'asia-south1';
export const MAX_SEATS = 12;
/** A human who hasn't sent a heartbeat for this long is replaced by a bot (until they come back). */
export const STALE_MS = 45_000;
/** Max actions per player in the rate window. */
export const RATE_LIMIT = { actions: 30, windowMs: 10_000 };
export const CHAT_LIMIT = { messages: 8, windowMs: 10_000, maxLength: 200 };
/** Rooms are deleted this long after their last update (also set as a TTL field). */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** Safety cap on bot/timeout steps processed in one request. */
export const MAX_AUTO_STEPS = 400;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
/** Moderation reports are deleted after this long. */
export const REPORT_TTL_MS = 365 * 24 * 60 * 60 * 1000;
