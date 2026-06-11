import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, onCleanup } from "solid-js";
import type * as Y from "yjs";

import { blobUrl } from "../assets/upload";

// Observes the `fonts` Y.Map (filename -> blob_id) and registers each font with
// the Typst engine via `addFont`. The engine has no unregister, so a removal
// only stops us re-adding on the next load: the running engine keeps the font
// until reload. The blob_id is the cache key; we never refetch unless it changes.
// `addFont` returns the canonical family the engine assigned (the name Typst
// groups and matches by), which we hand to `onFamily` for the picker.
// `onReady` fires once the initial batch of fonts present at load has settled
// (each fetch/register resolved or failed), so callers can wait for the preview
// to reflect custom fonts before treating compile output as final.
export function useFontsSync(
  projectId: () => string,
  project: () => TypstProject | null,
  fonts: () => Y.Map<string> | null,
  onFamily: (blobId: string, family: string) => void,
  onReady?: () => void
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
        const [family] = await proj.addFont(bytes);
        applied.set(name, blobId);
        if (family) onFamily(blobId, family);
      } catch (error) {
        // fetch throws AbortError when the project/effect tears down; swallow.
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("addFont failed:", name, error);
      }
    };

    const initial = [...map.entries()].map(([name, blobId]) => apply(name, blobId));
    void (async () => {
      await Promise.allSettled(initial);
      if (!aborter.signal.aborted) onReady?.();
    })();

    // The engine can't drop a single font, so a removal resets to the embedded
    // defaults and re-adds whatever's left. Cheap and rare: the blob GET is
    // immutable-cached, so the re-adds are cache hits.
    const reapplyAll = async () => {
      applied.clear();
      await proj.clearFonts();
      for (const [name, blobId] of map.entries()) void apply(name, blobId);
    };

    const observer = (event: Y.YMapEvent<string>) => {
      if ([...event.changes.keys.values()].some((c) => c.action === "delete")) {
        void reapplyAll();
        return;
      }
      // Additions stay incremental.
      for (const [name] of event.changes.keys) {
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
