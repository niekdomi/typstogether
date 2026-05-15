import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, onCleanup } from "solid-js";
import type * as Y from "yjs";

import { assetBlobUrl } from "./upload";

// Observes the `assets` Y.Map (path → sha256) and keeps the Typst project's
// virtual filesystem in sync by fetching binary blobs from the backend and
// calling `setBinary`. The sha256 is the cache key; we never refetch unless
// the hash changes for a path.
export function useAssetsSync(
  projectId: () => string,
  project: () => TypstProject | null,
  assets: () => Y.Map<string> | null
): void {
  createEffect(() => {
    const id = projectId();
    const proj = project();
    const map = assets();
    if (!id || !proj || !map) return;

    const applied = new Map<string, string>();
    const aborter = new AbortController();

    const apply = async (path: string, sha: string) => {
      if (applied.get(path) === sha) return;
      try {
        const res = await fetch(assetBlobUrl(id, sha), {
          credentials: "include",
          signal: aborter.signal,
        });
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        await proj.setBinary(path, bytes);
        applied.set(path, sha);
      } catch (error) {
        // fetch throws AbortError when the project/effect tears down; swallow.
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("setBinary failed:", path, error);
      }
    };

    for (const [path, sha] of map.entries()) {
      void apply(path, sha);
    }

    const observer = (event: Y.YMapEvent<string>) => {
      for (const [path, change] of event.changes.keys) {
        if (change.action === "delete") {
          applied.delete(path);
          void proj.remove(path);
          continue;
        }
        const sha = map.get(path);
        if (sha) void apply(path, sha);
      }
    };
    map.observe(observer);

    onCleanup(() => {
      aborter.abort();
      map.unobserve(observer);
    });
  });
}
