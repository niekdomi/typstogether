import { TooManyRequestsError } from "./errors";

// Per-process, in-memory cooldown keyed by an arbitrary string (e.g. a userId).
// Fine for the single backend instance; if it's ever horizontally scaled this
// needs shared state (e.g. Redis).
const lastHit = new Map<string, number>();

/**
 * Throws {@link TooManyRequestsError} if `key` was last hit less than
 * `cooldownMs` ago, otherwise records the hit and returns. Recording happens
 * before the guarded work runs, so two near-simultaneous requests (e.g. a
 * double-submit) collapse to one.
 */
export function enforceCooldown(key: string, cooldownMs: number, message: string): void {
  const now = Date.now();
  const last = lastHit.get(key);
  if (last !== undefined && now - last < cooldownMs) throw new TooManyRequestsError(message);
  lastHit.set(key, now);
}
