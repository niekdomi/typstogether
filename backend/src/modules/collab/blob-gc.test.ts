import { afterEach, describe, expect, test } from "bun:test";

import * as Y from "yjs";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { projectBlob } from "../../db/app-schema";
import { currentDb } from "../../transaction";
import { blobService } from "../blobs/service";
import { createBlobGcExtension } from "./blob-gc";

afterEach(cleanDb);

const ASSETS_KEY = "assets";
const extension = createBlobGcExtension({ graceSeconds: 0 });

const BYTES_A = new Uint8Array([1, 2, 3, 4]);
const SHA_A = "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a";
const BYTES_B = new Uint8Array([9, 9, 9]);
const SHA_B = "e740a6faf2db65f5853148d75d9a335d7c4b94ab106fe5f237bc34fdcfc74584";

// A minimal stub of the afterLoadDocument payload — we only use documentName
// and document. Cast through unknown to skip the full Hocuspocus types.
const loadDocument = async (documentName: string, document: Y.Doc): Promise<void> => {
  await extension.afterLoadDocument!({ documentName, document } as never);
};
const unloadDocument = async (document: Y.Doc): Promise<void> => {
  await extension.beforeUnloadDocument!({ document } as never);
};

// Drain Yjs observers and microtasks — the GC fires from observe() and schedules
// async work via `void blobService.gcProject(...)`; tick the loop until it lands.
const drain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const setupProject = async () => {
  const owner = await userFactory.create();
  const project = await projectFactory.create({ ownerUserId: owner.id });
  return project.id;
};

const storedShas = async (): Promise<string[]> => {
  const rows = await currentDb().select({ sha256: projectBlob.sha256 }).from(projectBlob);
  return rows.map((r) => r.sha256).toSorted();
};

describe("blobGcExtension", () => {
  test("afterLoadDocument reconciles: blob with no map reference is deleted", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    await loadDocument(projectId, doc);

    expect(await storedShas()).toEqual([]);
  });

  test("afterLoadDocument keeps blobs that ARE referenced", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    doc.getMap<string>(ASSETS_KEY).set("/a.png", SHA_A);

    await loadDocument(projectId, doc);

    expect(await storedShas()).toEqual([SHA_A]);
  });

  test("observer GCs a sha when the only reference is deleted", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);

    await loadDocument(projectId, doc);
    expect(await storedShas()).toEqual([SHA_A]);

    assets.delete("/a.png");
    await drain();

    expect(await storedShas()).toEqual([]);
  });

  test("observer keeps the sha when another path still references it (duplicate)", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);
    assets.set("/b.png", SHA_A); // duplicate path, same sha

    await loadDocument(projectId, doc);

    assets.delete("/a.png");
    await drain();

    // sha is still referenced via /b.png, so the row should survive
    expect(await storedShas()).toEqual([SHA_A]);
  });

  test("observer GCs the old sha when a path is overwritten with a new sha", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));
    await blobService.store(projectId, new File([BYTES_B], "b.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/logo.png", SHA_A);

    await loadDocument(projectId, doc);
    // SHA_B was never referenced; reconcile drops it. SHA_A survives.
    expect(await storedShas()).toEqual([SHA_A]);

    // Overwrite /logo.png with SHA_B — re-upload from a previous version
    await blobService.store(projectId, new File([BYTES_B], "b.png", { type: "image/png" }));
    assets.set("/logo.png", SHA_B);
    await drain();

    // SHA_A is no longer referenced anywhere; SHA_B is now the only ref.
    expect(await storedShas()).toEqual([SHA_B]);
  });

  test("beforeUnloadDocument detaches the observer (no more GC after unload)", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);

    await loadDocument(projectId, doc);
    await unloadDocument(doc);

    // Re-insert a blob and mutate the map. Observer is detached so nothing
    // should be GC'd.
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));
    assets.delete("/a.png");
    await drain();

    expect(await storedShas()).toEqual([SHA_A]);
  });
});
