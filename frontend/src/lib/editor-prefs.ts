import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

export const [vimMode, setVimMode] = makePersisted(createSignal(false), {
  name: "editor.vimMode",
});

export const [lineNumbers, setLineNumbers] = makePersisted(createSignal(true), {
  name: "editor.lineNumbers",
});

export const [relativeLineNumbers, setRelativeLineNumbers] = makePersisted(createSignal(false), {
  name: "editor.relativeLineNumbers",
});

// Toggles the browser's native spellchecker on the editor content. On by default.
export const [spellcheck, setSpellcheck] = makePersisted(createSignal(true), {
  name: "editor.spellcheck",
});

// Dark preview inverts the rendered document; independent of the app theme so a
// dark-mode user can still preview on a white page (and vice versa).
export const [previewDark, setPreviewDark] = makePersisted(createSignal(false), {
  name: "editor.previewDark",
});
