import { createSignal } from "solid-js";

const VIM_STORAGE_KEY = "editor.vimMode";

const [vimMode, setVimSignal] = createSignal(localStorage.getItem(VIM_STORAGE_KEY) === "true");

export { vimMode };

export function setVimMode(enabled: boolean): void {
  setVimSignal(enabled);
  localStorage.setItem(VIM_STORAGE_KEY, enabled ? "true" : "false");
}
