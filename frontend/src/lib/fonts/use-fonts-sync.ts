import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, onCleanup } from "solid-js";
import type * as Y from "yjs";

import { blobUrl } from "../assets/upload";

// Observes the `fonts` Y.Map (filename -> blob_id) and registers each font with
// the Typst engine via `addFont`. The engine has no unregister, so a removal
// only stops us re-adding on the next load: the running engine keeps the font
// until reload. The blob_id is the cache key; we never refetch unless it changes.
export function useFontsSync(
  projectId: () => string,
  project: () => TypstProject | null,
  fonts: () => Y.Map<string> | null
): void {
  createEffect(() => {
    const id = projectId();
    const proj = project();
    const map = fonts();
    if (!id || !proj || !map) return;

    const applied = new Map<string, string>();
    const aborter = new AbortController();

    const apply = async (name: string, blobId: string) => {
      if (applied.get(name) === blobId) return;
      try {
        const res = await fetch(blobUrl(id, blobId), {
          credentials: "include",
          signal: aborter.signal,
        });
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        await proj.addFont(bytes);
        applied.set(name, blobId);
      } catch (error) {
        // fetch throws AbortError when the project/effect tears down; swallow.
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("addFont failed:", name, error);
      }
    };

    for (const [name, blobId] of map.entries()) {
      void apply(name, blobId);
    }

    const observer = (event: Y.YMapEvent<string>) => {
      for (const [name, change] of event.changes.keys) {
        if (change.action === "delete") {
          // No engine unregister; just forget it so a same-named font with a new
          // blob_id re-registers. The removed font lingers until reload.
          applied.delete(name);
          continue;
        }
        const blobId = map.get(name);
        if (blobId) void apply(name, blobId);
      }
    };
    map.observe(observer);

    onCleanup(() => {
      aborter.abort();
      map.unobserve(observer);
    });
  });
}
