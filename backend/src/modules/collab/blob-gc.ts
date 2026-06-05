import type { Extension } from "@hocuspocus/server";
import { ASSETS_KEY, FONTS_KEY } from "@typstogether/shared";
import type * as Y from "yjs";

import { blobService } from "../blobs/service";

// Both the `assets` (path -> blob_id) and `fonts` (filename -> blob_id) maps
// store a blob_id as the value, so a removed/replaced entry orphans the same
// way: delete its backing blob.
const BLOB_MAP_KEYS = [ASSETS_KEY, FONTS_KEY] as const;

const observers = new WeakMap<Y.Doc, (event: Y.YMapEvent<string>) => void>();

export const blobGcExtension: Extension = {
  afterLoadDocument({ documentName, document }) {
    const observer = (event: Y.YMapEvent<string>) => {
      for (const change of event.changes.keys.values()) {
        if (change.action !== "delete" && change.action !== "update") continue;
        const oldId: unknown = change.oldValue;
        if (typeof oldId !== "string") continue;
        void blobService.deleteBlob(documentName, oldId);
      }
    };

    for (const key of BLOB_MAP_KEYS) document.getMap<string>(key).observe(observer);
    observers.set(document, observer);
    return Promise.resolve();
  },

  beforeUnloadDocument({ document }) {
    const observer = observers.get(document);
    if (observer) {
      for (const key of BLOB_MAP_KEYS) document.getMap<string>(key).unobserve(observer);
      observers.delete(document);
    }
    return Promise.resolve();
  },
};
