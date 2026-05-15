import type { Extension } from "@hocuspocus/server";
import type * as Y from "yjs";

import { blobService } from "../blobs/service";

// Must match the frontend's ASSETS_KEY (see frontend/src/lib/paths.ts).
const ASSETS_KEY = "assets";

// Hocuspocus extension that deletes a `project_blob` row immediately when its
// `blob_id` is removed from the `assets` Y.Map (delete or overwrite). Safe
// because each upload produces a unique `blob_id` — no other path can
// possibly reference it, so an orphaned id is unambiguously deletable.
//
// Failed mid-flight uploads (client crashed before committing
// `assets.set(path, id)`) leak one row per occurrence. Acceptable for our
// scale; can be cleaned up later with a one-shot script if it becomes a
// real cost.
const observers = new WeakMap<Y.Doc, (event: Y.YMapEvent<string>) => void>();

export const blobGcExtension: Extension = {
  afterLoadDocument({ documentName, document }) {
    const assets = document.getMap<string>(ASSETS_KEY);

    const observer = (event: Y.YMapEvent<string>) => {
      for (const change of event.changes.keys.values()) {
        if (change.action !== "delete" && change.action !== "update") continue;
        const oldId: unknown = change.oldValue;
        if (typeof oldId !== "string") continue;
        void blobService.deleteBlob(documentName, oldId);
      }
    };

    assets.observe(observer);
    observers.set(document, observer);
    return Promise.resolve();
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
