import { afterEach, describe, expect, test } from "bun:test";

import { ASSETS_KEY } from "@typstogether/shared";
import * as Y from "yjs";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { projectBlob } from "../../db/app-schema";
import { currentDb } from "../../transaction";
import { blobService } from "../blobs/service";
import { blobGcExtension } from "./blob-gc";

afterEach(cleanDb);

const BYTES_A = new Uint8Array([1, 2, 3, 4]);
const BYTES_B = new Uint8Array([9, 9, 9]);

const loadDocument = (documentName: string, document: Y.Doc): Promise<unknown> =>
  blobGcExtension.afterLoadDocument!({ documentName, document } as never);
const unloadDocument = (document: Y.Doc): Promise<unknown> =>
  blobGcExtension.beforeUnloadDocument!({ document } as never);

// The observer fires `void blobService.deleteBlob(...)`; let microtasks land.
const drain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const setupProject = async (): Promise<string> => {
  const owner = await userFactory.create();
  const project = await projectFactory.create({ ownerUserId: owner.id });
  return project.id;
};

const countRows = async (projectId: string): Promise<number> => {
  const rows = await currentDb().select().from(projectBlob);
  return rows.filter((r) => r.projectId === projectId).length;
};

describe("blobGcExtension", () => {
  test("observer deletes the row when its only path is removed", async () => {
    const projectId = await setupProject();
    const meta = await blobService.store(
      projectId,
      new File([BYTES_A], "a.png", { type: "image/png" })
    );

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", meta.id);

    await loadDocument(projectId, doc);

    assets.delete("/a.png");
    await drain();

    expect(await countRows(projectId)).toBe(0);
  });

  test("observer deletes the old id when a path is overwritten with a new id", async () => {
    const projectId = await setupProject();
    const oldMeta = await blobService.store(
      projectId,
      new File([BYTES_A], "a.png", { type: "image/png" })
    );
    const newMeta = await blobService.store(
      projectId,
      new File([BYTES_B], "b.png", { type: "image/png" })
    );

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/logo.png", oldMeta.id);

    await loadDocument(projectId, doc);

    assets.set("/logo.png", newMeta.id);
    await drain();

    // Old row gone, new row remains
    expect(await countRows(projectId)).toBe(1);
    const remaining = await blobService.fetch(projectId, newMeta.id);
    expect(remaining.bytes).toEqual(BYTES_B);
  });

  test("set without an oldValue (insert) doesn't trigger any delete", async () => {
    const projectId = await setupProject();
    const meta = await blobService.store(
      projectId,
      new File([BYTES_A], "a.png", { type: "image/png" })
    );

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);

    await loadDocument(projectId, doc);

    // Brand-new key, oldValue is undefined -> action is "add"
    assets.set("/a.png", meta.id);
    await drain();

    expect(await countRows(projectId)).toBe(1);
  });

  test("beforeUnloadDocument detaches the observer", async () => {
    const projectId = await setupProject();
    const meta = await blobService.store(
      projectId,
      new File([BYTES_A], "a.png", { type: "image/png" })
    );

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", meta.id);

    await loadDocument(projectId, doc);
    await unloadDocument(doc);

    // Mutations after unload must not delete anything.
    assets.delete("/a.png");
    await drain();

    expect(await countRows(projectId)).toBe(1);
  });
});
