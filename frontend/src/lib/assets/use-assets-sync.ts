import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, onCleanup } from "solid-js";
import type * as Y from "yjs";

import { blobUrl } from "./upload";

// Observes the `assets` Y.Map (path -> blob_id) and keeps the Typst project's
// virtual filesystem in sync by fetching binary blobs from the backend and
// calling `setBinary`. The blob_id is the cache key; we never refetch for a
// path unless its id changes.
//
// `onReady` fires once the initial batch of assets present at load has settled
// (each fetch resolved or failed). Until then, compiles report the not-yet-
// loaded assets as missing files; callers use this to suppress those transient
// errors and show a loading state.
export function useAssetsSync(
  projectId: () => string,
  project: () => TypstProject | null,
  assets: () => Y.Map<string> | null,
  onReady?: () => void
): void {
  createEffect(() => {
    const id = projectId();
    const proj = project();
    const map = assets();
    if (!id || !proj || !map) return;

    const applied = new Map<string, string>();
    const aborter = new AbortController();

    const apply = async (path: string, blobId: string) => {
      if (applied.get(path) === blobId) return;
      try {
        const res = await fetch(blobUrl(id, blobId), {
          credentials: "include",
          signal: aborter.signal,
        });
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        await proj.setBinary(path, bytes);
        applied.set(path, blobId);
      } catch (error) {
        // fetch throws AbortError when the project/effect tears down; swallow.
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("setBinary failed:", path, error);
      }
    };

    const initial = [...map.entries()].map(([path, blobId]) => apply(path, blobId));
    void (async () => {
      await Promise.allSettled(initial);
      if (!aborter.signal.aborted) onReady?.();
    })();

    const observer = (event: Y.YMapEvent<string>) => {
      for (const [path, change] of event.changes.keys) {
        if (change.action === "delete") {
          applied.delete(path);
          void proj.remove(path);
          continue;
        }
        const blobId = map.get(path);
        if (blobId) void apply(path, blobId);
      }
    };
    map.observe(observer);

    onCleanup(() => {
      aborter.abort();
      map.unobserve(observer);
    });
  });
}
