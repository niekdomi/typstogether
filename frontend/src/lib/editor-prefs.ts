import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

export const [vimMode, setVimMode] = makePersisted(createSignal(false), {
  name: "editor.vimMode",
});
