import { baseUrl } from "../api";

export function collabWsUrl(): string {
  const url = new URL("/api/collab", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
