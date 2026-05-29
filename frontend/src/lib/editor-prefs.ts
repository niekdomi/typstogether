import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

export const [vimMode, setVimMode] = makePersisted(createSignal(false), {
  name: "editor.vimMode",
});

export const [showLineNumbers, setShowLineNumbers] = makePersisted(createSignal(true), {
  name: "editor.showLineNumbers",
});

export const [relativeLineNumbers, setRelativeLineNumbers] = makePersisted(createSignal(false), {
  name: "editor.relativeLineNumbers",
});

// Dark preview inverts the rendered document; independent of the app theme so a
// dark-mode user can still preview on a white page (and vice versa).
export const [previewDark, setPreviewDark] = makePersisted(createSignal(false), {
  name: "editor.previewDark",
});
