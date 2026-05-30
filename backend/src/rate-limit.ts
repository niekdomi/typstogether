import { Elysia } from "elysia";

import { TooManyRequestsError } from "./errors";
import { authMacro } from "./modules/auth/macro";

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
    for (const [k, expiresAt] of expiry) {
      if (expiresAt <= now) expiry.delete(k);
    }
    lastSweep = now;
  }

  const expiresAt = expiry.get(key);
  if (expiresAt !== undefined && expiresAt > now) throw new TooManyRequestsError(message);
  expiry.set(key, now + cooldownMs);
}

export interface CooldownOptions {
  /** Namespace for the cooldown key; combined with the caller's user id. */
  key: string;
  /** Minimum gap between accepted requests, in milliseconds. */
  ms: number;
  /** User-facing 429 message shown while the cooldown is active. */
  message: string;
}

/**
 * Per-route, per-user cooldown. Apply with `cooldown: { key, ms, message }` on a
 * route; the key is namespaced by the caller's user id, so it implies `auth`.
 * Mirrors the auth/authorization macro convention (see projects/macro.ts).
 */
export const cooldownMacro = new Elysia({ name: "cooldown-macro" })
  .use(authMacro)
  .macro("cooldown", (options: CooldownOptions) => ({
    auth: true,
    beforeHandle: (context) => {
      // `auth: true` resolves the session before this runs, so `user` is present
      // at runtime; Elysia's function-macro typing doesn't thread it into the
      // context, hence the narrowing cast.
      const { user } = context as typeof context & { user: { id: string } };
      enforceCooldown(`${options.key}:${user.id}`, options.ms, options.message);
    },
  }));
