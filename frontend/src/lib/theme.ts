import { createSignal } from "solid-js";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function detectInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme): void {
  document.documentElement.dataset["theme"] = t;
}

const [theme, setThemeSignal] = createSignal<Theme>(detectInitial());
applyTheme(theme());

globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (localStorage.getItem(STORAGE_KEY)) return;
  const next: Theme = e.matches ? "dark" : "light";
  applyTheme(next);
  setThemeSignal(next);
});

export { theme };

export function toggleTheme(): void {
  const next: Theme = theme() === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  setThemeSignal(next);
}
