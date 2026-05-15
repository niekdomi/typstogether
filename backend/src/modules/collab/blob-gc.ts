import type { Extension } from "@hocuspocus/server";
import type * as Y from "yjs";

import { blobService } from "../blobs/service";

// Must match the frontend's ASSETS_KEY (see frontend/src/lib/paths.ts).
const ASSETS_KEY = "assets";

// Hocuspocus extension that keeps the `project_blob` table's `pending_gc_at`
// marks in sync with the `assets` Y.Map (path → sha256). Two-pronged:
//
//   1. afterLoadDocument: one reconcile pass — refresh marks against the
//      loaded map. Catches blobs orphaned by failed mid-flight uploads or
//      drift accumulated while the doc was unloaded.
//
//   2. Y.Map observer: on every assets mutation, refresh marks. Re-references
//      cancel pending marks; new orphans get marked. Runs in the same process
//      that serializes all writes for the document — no race for refcount.
//
// Actual deletion happens in a separate sweeper after a delay, so a concurrent
// duplicate-set arriving shortly after a delete cancels the mark before any
// row is removed. See `blobService.refreshMarks` and `blobService.sweepMarked`.
const observers = new WeakMap<Y.Doc, (event: Y.YMapEvent<string>) => void>();

export const blobGcExtension: Extension = {
  async afterLoadDocument({ documentName, document }) {
    const assets = document.getMap<string>(ASSETS_KEY);

    await blobService.refreshMarks(documentName, assets.values());

    const observer = (event: Y.YMapEvent<string>) => {
      // Any mutation can change either side: a delete/update may orphan a sha,
      // and an add/update may unmark one. Cheap enough to refresh on each.
      if (event.changes.keys.size === 0) return;
      void blobService.refreshMarks(documentName, assets.values());
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
