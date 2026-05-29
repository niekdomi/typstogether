import { TooManyRequestsError } from "./errors";

// Per-process, in-memory cooldown keyed by an arbitrary string (e.g. a userId).
// Fine for the single backend instance; if it's ever horizontally scaled this
// needs shared state (e.g. Redis).
//
// The value is the timestamp at which the key's cooldown expires. Expired keys
// are swept lazily (at most once per SWEEP_INTERVAL_MS) so the map stays bounded
// by recently-active keys rather than every key ever seen.
const expiry = new Map<string, number>();
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

/**
 * Throws {@link TooManyRequestsError} if `key`'s cooldown is still active,
 * otherwise arms a fresh `cooldownMs` window and returns. Arming happens before
 * the guarded work runs, so two near-simultaneous requests (e.g. a
 * double-submit) collapse to one.
 */
export function enforceCooldown(key: string, cooldownMs: number, message: string): void {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    for (const [k, expiresAt] of expiry) if (expiresAt <= now) expiry.delete(k);
    lastSweep = now;
  }

  const expiresAt = expiry.get(key);
  if (expiresAt !== undefined && expiresAt > now) throw new TooManyRequestsError(message);
  expiry.set(key, now + cooldownMs);
}
