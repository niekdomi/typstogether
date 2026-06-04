import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

import {
  DEFAULT_EDITOR_THEME,
  EDITOR_THEME_KEYS,
  type EditorThemeKey,
} from "../routes/project/editor-theme";

// The active theme (key into EDITOR_THEMES). Source of truth for the editor
// colors and, via App's root effect, the whole app chrome + light/dark polarity.
export const [editorTheme, setEditorTheme] = makePersisted(
  createSignal<EditorThemeKey>(DEFAULT_EDITOR_THEME),
  { name: "editor.theme" }
);

// Drop a persisted theme that no longer exists (e.g. a removed one) so a stale
// localStorage value can't break the registry lookups on load.
if (!EDITOR_THEME_KEYS.includes(editorTheme())) {
  setEditorTheme(DEFAULT_EDITOR_THEME);
}

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
