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
