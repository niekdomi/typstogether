import type { Extension } from "@hocuspocus/server";
import type * as Y from "yjs";

import { blobService } from "../blobs/service";

// Must match the frontend's ASSETS_KEY (see frontend/src/lib/paths.ts).
const ASSETS_KEY = "assets";

interface BlobGcOptions {
  // Blobs younger than this aren't GC'd, in case a concurrent duplicate-set is
  // in flight. Set to 0 in tests for deterministic behavior.
  graceSeconds?: number;
}

// Hocuspocus extension that keeps the `project_blob` table in sync with the
// `assets` Y.Map (path → sha256). Two-pronged:
//
//   1. afterLoadDocument: one reconcile pass — deletes any blob row not
//      referenced by the loaded map. Catches case 3 (failed mid-flight upload)
//      and any drift accumulated while the doc was unloaded.
//
//   2. Y.Map observer: on every assets mutation, if the old value (deleted or
//      replaced sha) is no longer referenced anywhere in the map, GC it. Runs
//      in real time, in the same process that serializes all writes for the
//      document — no client race window for refcount.
//
// The grace window in `blobService.gcProject` protects blobs from being deleted
// out from under a concurrent duplicate-set landing right after a delete.
const observers = new WeakMap<Y.Doc, (event: Y.YMapEvent<string>) => void>();

export function createBlobGcExtension(options: BlobGcOptions = {}): Extension {
  const graceSeconds = options.graceSeconds ?? 30;

  return {
    async afterLoadDocument({ documentName, document }) {
      const assets = document.getMap<string>(ASSETS_KEY);

      // Reconcile pass: drop anything in the table that isn't referenced.
      await blobService.gcProject(documentName, assets.values(), graceSeconds);

      // Real-time observer for subsequent mutations.
      const observer = (event: Y.YMapEvent<string>) => {
        const candidates = new Set<string>();
        for (const change of event.changes.keys.values()) {
          if (change.action === "delete" || change.action === "update") {
            const oldSha: unknown = change.oldValue;
            if (typeof oldSha === "string") candidates.add(oldSha);
          }
        }
        if (candidates.size === 0) return;

        const stillReferenced = new Set(assets.values());
        const orphans = [...candidates].filter((sha) => !stillReferenced.has(sha));
        if (orphans.length === 0) return;

        // We GC by giving the full reference set, not the orphan list. This is
        // tolerant of races: if a concurrent set added a new asset between the
        // observer firing and the DELETE running, that new sha is in the set
        // and is safe; the orphans aren't, so they get cleaned.
        void blobService.gcProject(documentName, assets.values(), graceSeconds);
      };

      assets.observe(observer);
      observers.set(document, observer);
    },

    beforeUnloadDocument({ document }) {
      const observer = observers.get(document);
      if (observer) {
        document.getMap<string>(ASSETS_KEY).unobserve(observer);
        observers.delete(document);
      }
      return Promise.resolve();
    },
  };
}

export const blobGcExtension = createBlobGcExtension();
