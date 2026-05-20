import type { Extension } from "@hocuspocus/server";
import { ASSETS_KEY } from "@typstogether/shared";
import type * as Y from "yjs";

import { blobService } from "../blobs/service";

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
