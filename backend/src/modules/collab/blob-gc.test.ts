import { afterEach, describe, expect, test } from "bun:test";

import { and, eq } from "drizzle-orm";
import * as Y from "yjs";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { projectBlob } from "../../db/app-schema";
import { currentDb } from "../../transaction";
import { blobService } from "../blobs/service";
import { blobGcExtension } from "./blob-gc";

afterEach(cleanDb);

const ASSETS_KEY = "assets";

const BYTES_A = new Uint8Array([1, 2, 3, 4]);
const SHA_A = "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a";
const BYTES_B = new Uint8Array([9, 9, 9]);
const SHA_B = "e740a6faf2db65f5853148d75d9a335d7c4b94ab106fe5f237bc34fdcfc74584";

// A minimal stub of the afterLoadDocument payload — we only use documentName
// and document. Cast through unknown to skip the full Hocuspocus types.
const loadDocument = async (documentName: string, document: Y.Doc): Promise<void> => {
  await blobGcExtension.afterLoadDocument!({ documentName, document } as never);
};
const unloadDocument = async (document: Y.Doc): Promise<void> => {
  await blobGcExtension.beforeUnloadDocument!({ document } as never);
};

// The observer calls refreshMarks via `void`; let microtasks land before assertions.
const drain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const setupProject = async (): Promise<string> => {
  const owner = await userFactory.create();
  const project = await projectFactory.create({ ownerUserId: owner.id });
  return project.id;
};

const fetchMark = async (projectId: string, sha256: string): Promise<Date | null> => {
  const [row] = await currentDb()
    .select({ pendingGcAt: projectBlob.pendingGcAt })
    .from(projectBlob)
    .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.sha256, sha256)));
  return row?.pendingGcAt ?? null;
};

describe("blobGcExtension", () => {
  test("afterLoadDocument marks blobs with no map reference", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    await loadDocument(projectId, doc);

    expect(await fetchMark(projectId, SHA_A)).toBeInstanceOf(Date);
  });

  test("afterLoadDocument keeps blobs that ARE referenced unmarked", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    doc.getMap<string>(ASSETS_KEY).set("/a.png", SHA_A);

    await loadDocument(projectId, doc);

    expect(await fetchMark(projectId, SHA_A)).toBeNull();
  });

  test("observer marks a sha when its only reference is deleted", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);

    await loadDocument(projectId, doc);
    expect(await fetchMark(projectId, SHA_A)).toBeNull();

    assets.delete("/a.png");
    await drain();

    expect(await fetchMark(projectId, SHA_A)).toBeInstanceOf(Date);
  });

  test("observer doesn't mark when another path still references the sha (duplicate)", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);
    assets.set("/b.png", SHA_A);

    await loadDocument(projectId, doc);

    assets.delete("/a.png");
    await drain();

    expect(await fetchMark(projectId, SHA_A)).toBeNull();
  });

  test("observer cancels the mark when a previously-orphaned sha is re-referenced", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);

    await loadDocument(projectId, doc);

    // Step 1: orphan it → mark applied
    assets.delete("/a.png");
    await drain();
    expect(await fetchMark(projectId, SHA_A)).toBeInstanceOf(Date);

    // Step 2: re-reference (e.g. concurrent duplicate-set) → mark cleared
    assets.set("/b.png", SHA_A);
    await drain();
    expect(await fetchMark(projectId, SHA_A)).toBeNull();
  });

  test("observer marks the old sha when a path is overwritten with a new sha", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));
    await blobService.store(projectId, new File([BYTES_B], "b.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/logo.png", SHA_A);

    await loadDocument(projectId, doc);
    // SHA_A is referenced; SHA_B isn't
    expect(await fetchMark(projectId, SHA_A)).toBeNull();
    expect(await fetchMark(projectId, SHA_B)).toBeInstanceOf(Date);

    // Overwrite /logo.png with SHA_B
    assets.set("/logo.png", SHA_B);
    await drain();

    // SHA_A is now orphaned → marked; SHA_B is now referenced → unmarked
    expect(await fetchMark(projectId, SHA_A)).toBeInstanceOf(Date);
    expect(await fetchMark(projectId, SHA_B)).toBeNull();
  });

  test("end-to-end: marked blob is deleted after sweep with a generous cutoff", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);

    await loadDocument(projectId, doc);

    assets.delete("/a.png");
    await drain();

    // Cutoff in the future → catches the mark
    const deleted = await blobService.sweepMarked(new Date(Date.now() + 1000));
    expect(deleted).toEqual([SHA_A]);
    const rows = await currentDb().select().from(projectBlob);
    expect(rows).toEqual([]);
  });

  test("beforeUnloadDocument detaches the observer", async () => {
    const projectId = await setupProject();
    await blobService.store(projectId, new File([BYTES_A], "a.png", { type: "image/png" }));

    const doc = new Y.Doc();
    const assets = doc.getMap<string>(ASSETS_KEY);
    assets.set("/a.png", SHA_A);

    await loadDocument(projectId, doc);
    await unloadDocument(doc);

    // After unload, mutations should not trigger refreshMarks. The sha is
    // still unreferenced after the delete but the row's mark must stay NULL.
    assets.delete("/a.png");
    await drain();

    expect(await fetchMark(projectId, SHA_A)).toBeNull();
  });
});
