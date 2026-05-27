import { afterEach, describe, expect, test } from "bun:test";

import { META_KEY, THUMBNAIL_KEY } from "@typstogether/shared";
import { eq } from "drizzle-orm";
import * as Y from "yjs";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { project as projectTable, projectBlob } from "../../db/app-schema";
import { currentDb } from "../../transaction";
import type { BlobMeta } from "../blobs/model";
import { blobService } from "../blobs/service";
import { projectService } from "../projects/service";
import { thumbnailSyncExtension } from "./thumbnail-sync";

afterEach(cleanDb);

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

const loadDocument = (documentName: string, document: Y.Doc): Promise<unknown> =>
  thumbnailSyncExtension.afterLoadDocument!({ documentName, document } as never);
const unloadDocument = (document: Y.Doc): Promise<unknown> =>
  thumbnailSyncExtension.beforeUnloadDocument!({ document } as never);

// Observer fires void promises; let microtasks land.
const drain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const setupProject = async (): Promise<string> => {
  const owner = await userFactory.create();
  const proj = await projectFactory.create({ ownerUserId: owner.id });
  return proj.id;
};

const storeSvg = (projectId: string): Promise<BlobMeta> =>
  blobService.store(projectId, new File([SVG], "thumb.svg", { type: "image/svg+xml" }));

const fetchThumbnailColumn = async (projectId: string): Promise<string | null> => {
  const [row] = await currentDb()
    .select({ thumbnailBlobId: projectTable.thumbnailBlobId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId));
  return row?.thumbnailBlobId ?? null;
};

const countBlobs = async (projectId: string): Promise<number> => {
  const rows = await currentDb()
    .select()
    .from(projectBlob)
    .where(eq(projectBlob.projectId, projectId));
  return rows.length;
};

describe("thumbnailSyncExtension", () => {
  test("first thumbnail write mirrors blob_id into the project column", async () => {
    const projectId = await setupProject();
    const meta = await storeSvg(projectId);

    const doc = new Y.Doc();
    await loadDocument(projectId, doc);
    doc.getMap<string>(META_KEY).set(THUMBNAIL_KEY, meta.id);
    await drain();

    expect(await fetchThumbnailColumn(projectId)).toBe(meta.id);
  });

  test("replacing the thumbnail deletes the previous blob and updates the column", async () => {
    const projectId = await setupProject();
    const first = await storeSvg(projectId);
    const second = await storeSvg(projectId);

    const doc = new Y.Doc();
    const meta = doc.getMap<string>(META_KEY);
    meta.set(THUMBNAIL_KEY, first.id);
    await loadDocument(projectId, doc);

    meta.set(THUMBNAIL_KEY, second.id);
    await drain();

    expect(await fetchThumbnailColumn(projectId)).toBe(second.id);
    expect(await countBlobs(projectId)).toBe(1);
  });

  test("delete clears the column and deletes the blob", async () => {
    const projectId = await setupProject();
    const meta = await storeSvg(projectId);

    const doc = new Y.Doc();
    const metaMap = doc.getMap<string>(META_KEY);
    metaMap.set(THUMBNAIL_KEY, meta.id);
    await loadDocument(projectId, doc);

    metaMap.delete(THUMBNAIL_KEY);
    await drain();

    expect(await fetchThumbnailColumn(projectId)).toBeNull();
    expect(await countBlobs(projectId)).toBe(0);
  });

  test("writes to other meta keys (e.g. entry) are ignored", async () => {
    const projectId = await setupProject();

    const doc = new Y.Doc();
    await loadDocument(projectId, doc);
    doc.getMap<string>(META_KEY).set("entry", "/main.typ");
    await drain();

    expect(await fetchThumbnailColumn(projectId)).toBeNull();
  });

  test("skips mirror and GC when the project is soft-deleted", async () => {
    const projectId = await setupProject();
    const first = await storeSvg(projectId);
    const second = await storeSvg(projectId);

    const doc = new Y.Doc();
    const metaMap = doc.getMap<string>(META_KEY);
    metaMap.set(THUMBNAIL_KEY, first.id);
    await loadDocument(projectId, doc);
    await projectService.remove(projectId);

    metaMap.set(THUMBNAIL_KEY, second.id);
    await drain();

    // Mirror short-circuits on the deletedAt filter, so the GC must not run -
    // the first blob still has to exist for any post-restore recovery.
    expect(await countBlobs(projectId)).toBe(2);
  });

  test("repeated write of the same value short-circuits", async () => {
    const projectId = await setupProject();
    const meta = await storeSvg(projectId);

    const doc = new Y.Doc();
    const metaMap = doc.getMap<string>(META_KEY);
    await loadDocument(projectId, doc);
    metaMap.set(THUMBNAIL_KEY, meta.id);
    await drain();

    // Yjs emits an event even for set-to-same-value; the observer should
    // notice oldId === newId and skip both the UPDATE and the deleteBlob.
    metaMap.set(THUMBNAIL_KEY, meta.id);
    await drain();

    expect(await countBlobs(projectId)).toBe(1);
    expect(await fetchThumbnailColumn(projectId)).toBe(meta.id);
  });

  test("beforeUnloadDocument detaches the observer", async () => {
    const projectId = await setupProject();
    const meta = await storeSvg(projectId);

    const doc = new Y.Doc();
    const metaMap = doc.getMap<string>(META_KEY);
    await loadDocument(projectId, doc);
    await unloadDocument(doc);

    metaMap.set(THUMBNAIL_KEY, meta.id);
    await drain();

    expect(await fetchThumbnailColumn(projectId)).toBeNull();
    expect(await countBlobs(projectId)).toBe(1);
  });
});
