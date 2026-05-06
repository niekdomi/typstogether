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

const FADE_MS = 200;

const [theme, setThemeSignal] = createSignal<Theme>(detectInitial());
applyTheme(theme());

function setThemeWithFade(next: Theme): void {
  const root = document.documentElement;
  root.classList.add("theme-fade");
  applyTheme(next);
  setThemeSignal(next);
  setTimeout(() => {
    root.classList.remove("theme-fade");
  }, FADE_MS);
}

globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (localStorage.getItem(STORAGE_KEY)) return;
  setThemeWithFade(e.matches ? "dark" : "light");
});

export { theme };

export function toggleTheme(): void {
  const next: Theme = theme() === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  setThemeWithFade(next);
}
