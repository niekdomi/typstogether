import { treaty } from "@elysiajs/eden/treaty2";
import type { App } from "@typstogether/backend";

export const baseUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000";

export const api = treaty<App>(baseUrl, {
  fetch: { credentials: "include" },
});
