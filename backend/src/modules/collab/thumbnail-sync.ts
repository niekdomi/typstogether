import type { Extension } from "@hocuspocus/server";
import { META_KEY, THUMBNAIL_KEY } from "@typstogether/shared";
import { and, eq, isNull } from "drizzle-orm";
import type * as Y from "yjs";

import { project } from "../../db/app-schema";
import { currentDb } from "../../transaction";
import { blobService } from "../blobs/service";

const observers = new WeakMap<Y.Doc, (event: Y.YMapEvent<string>) => void>();

/**
 * Mirror the thumbnail pointer into the project row, skipping soft-deleted
 * projects. Returns whether a live row was touched.
 */
async function mirror(projectId: string, blobId: string | null): Promise<boolean> {
  const rows = await currentDb()
    .update(project)
    .set({ thumbnailBlobId: blobId })
    .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
    .returning();
  return rows.length > 0;
}

/**
 * `meta[THUMBNAIL_KEY]` is the source of truth for the dashboard thumbnail
 * blob_id. Mirror writes into `project.thumbnail_blob_id` (so the dashboard
 * list query is one SQL read) and GC the replaced blob (so concurrent
 * uploaders' losing rows don't leak).
 */
export const thumbnailSyncExtension: Extension = {
  afterLoadDocument({ documentName, document }) {
    const meta = document.getMap<string>(META_KEY);

    const observer = (event: Y.YMapEvent<string>) => {
      const change = event.changes.keys.get(THUMBNAIL_KEY);
      if (!change) return;

      const oldId = typeof change.oldValue === "string" ? change.oldValue : null;
      const newId = change.action === "delete" ? null : (meta.get(THUMBNAIL_KEY) ?? null);
      if (oldId === newId) return;

      void (async () => {
        const applied = await mirror(documentName, newId);
        if (applied && oldId) void blobService.deleteBlob(documentName, oldId);
      })();
    };

    meta.observe(observer);
    observers.set(document, observer);
    return Promise.resolve();
  },

  beforeUnloadDocument({ document }) {
    const observer = observers.get(document);
    if (observer) {
      document.getMap<string>(META_KEY).unobserve(observer);
      observers.delete(document);
    }
    return Promise.resolve();
  },
};
