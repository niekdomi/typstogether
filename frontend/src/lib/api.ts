import { treaty } from "@elysiajs/eden/treaty2";
import type { App } from "@typstogether/backend";

export const baseUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000";

export const api = treaty<App>(baseUrl, {
  fetch: { credentials: "include" },
}).api;

// Eden Treaty surfaces failures as `{ status, value }`. Backend HttpErrors come
// back as a plain-string body (app.ts's `onError`), and for client errors (4xx)
// that message is written to be user-facing, so prefer it over the caller's
// fallback. 5xx bodies and non-string values (e.g. 422 validation objects) are
// leaky or unreadable, so they fall back to the generic message instead.
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;
  if (!("status" in error) || typeof error.status !== "number") return fallback;
  if (error.status < 400 || error.status >= 500) return fallback;
  if (!("value" in error) || typeof error.value !== "string" || error.value.length === 0)
    return fallback;
  return error.value;
}
