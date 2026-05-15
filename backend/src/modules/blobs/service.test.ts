import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { and, eq } from "drizzle-orm";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { projectBlob } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { blobService } from "./service";

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_SHA256 = "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6";

const fileFromBytes = (bytes: Uint8Array, mime = "image/png", name = "blob.png"): File =>
  new File([bytes], name, { type: mime });

describe("BlobService", () => {
  let projectId: string;

  beforeEach(async () => {
    const owner = await userFactory.create();
    const proj = await projectFactory.create({ ownerUserId: owner.id });
    projectId = proj.id;
  });

  afterEach(cleanDb);

  describe("store", () => {
    it("computes sha256, stores bytes, and returns metadata", async () => {
      const meta = await blobService.store(projectId, fileFromBytes(PNG_BYTES));

      expect(meta.sha256).toBe(PNG_SHA256);
      expect(meta.mime).toBe("image/png");
      expect(meta.size).toBe(PNG_BYTES.byteLength);

      const [row] = await currentDb()
        .select()
        .from(projectBlob)
        .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.sha256, meta.sha256)));
      expect(row?.bytes).toEqual(PNG_BYTES);
    });

    it("is idempotent for the same content (no-op on conflict)", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));

      const rows = await currentDb()
        .select()
        .from(projectBlob)
        .where(eq(projectBlob.projectId, projectId));
      expect(rows.length).toBe(1);
    });

    it("scopes blobs per project (same sha256 in two projects → two rows)", async () => {
      const otherOwner = await userFactory.create();
      const otherProject = await projectFactory.create({ ownerUserId: otherOwner.id });

      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.store(otherProject.id, fileFromBytes(PNG_BYTES));

      const rows = await currentDb()
        .select()
        .from(projectBlob)
        .where(eq(projectBlob.sha256, PNG_SHA256));
      expect(rows.length).toBe(2);
    });
  });

  describe("fetch", () => {
    it("returns the stored blob", async () => {
      const meta = await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      const blob = await blobService.fetch(projectId, meta.sha256);

      expect(blob.bytes).toEqual(PNG_BYTES);
      expect(blob.mime).toBe("image/png");
      expect(blob.size).toBe(PNG_BYTES.byteLength);
    });

    it("throws NotFoundError when the blob is missing in this project", async () => {
      await expectThrows(() => blobService.fetch(projectId, PNG_SHA256), NotFoundError);
    });

    it("does not return blobs from another project with the same sha256", async () => {
      const otherOwner = await userFactory.create();
      const otherProject = await projectFactory.create({ ownerUserId: otherOwner.id });
      await blobService.store(otherProject.id, fileFromBytes(PNG_BYTES));

      await expectThrows(() => blobService.fetch(projectId, PNG_SHA256), NotFoundError);
    });
  });

  describe("refreshMarks + sweepMarked", () => {
    const OTHER_BYTES = new Uint8Array([1, 2, 3, 4]);
    const OTHER_SHA256 = "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a";

    const fetchMark = async (sha256: string): Promise<Date | null> => {
      const [row] = await currentDb()
        .select({ pendingGcAt: projectBlob.pendingGcAt })
        .from(projectBlob)
        .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.sha256, sha256)));
      return row?.pendingGcAt ?? null;
    };

    it("marks blobs not in the referenced set", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.store(projectId, fileFromBytes(OTHER_BYTES, "image/jpeg", "other.jpg"));

      await blobService.refreshMarks(projectId, [PNG_SHA256]);

      expect(await fetchMark(PNG_SHA256)).toBeNull();
      expect(await fetchMark(OTHER_SHA256)).toBeInstanceOf(Date);
    });

    it("clears the mark when a previously unreferenced sha becomes referenced", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.refreshMarks(projectId, []);
      expect(await fetchMark(PNG_SHA256)).toBeInstanceOf(Date);

      await blobService.refreshMarks(projectId, [PNG_SHA256]);
      expect(await fetchMark(PNG_SHA256)).toBeNull();
    });

    it("preserves existing marks (doesn't move pending_gc_at forward on every refresh)", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.refreshMarks(projectId, []);
      const firstMark = await fetchMark(PNG_SHA256);
      expect(firstMark).toBeInstanceOf(Date);

      // Wait a tick so a re-mark would have a newer timestamp
      await new Promise((resolve) => setTimeout(resolve, 5));
      await blobService.refreshMarks(projectId, []);
      const secondMark = await fetchMark(PNG_SHA256);
      expect(secondMark!.getTime()).toBe(firstMark!.getTime());
    });

    it("sweepMarked deletes only marked rows older than the cutoff", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.store(projectId, fileFromBytes(OTHER_BYTES, "image/jpeg", "other.jpg"));

      // Mark only PNG; OTHER stays referenced (and unmarked)
      await blobService.refreshMarks(projectId, [OTHER_SHA256]);

      const cutoff = new Date(Date.now() + 1000); // future cutoff: catches mark
      const deleted = await blobService.sweepMarked(cutoff);

      expect(deleted).toEqual([PNG_SHA256]);
      const remaining = await currentDb().select().from(projectBlob);
      expect(remaining.map((r) => r.sha256)).toEqual([OTHER_SHA256]);
    });

    it("sweepMarked leaves marked rows alone if cutoff is in the past", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.refreshMarks(projectId, []);

      const cutoff = new Date(Date.now() - 60_000); // 1 minute ago
      const deleted = await blobService.sweepMarked(cutoff);

      expect(deleted).toEqual([]);
      const remaining = await currentDb().select().from(projectBlob);
      expect(remaining).toHaveLength(1);
    });

    it("sweepMarked never deletes unmarked rows", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      // Don't call refreshMarks — pending_gc_at stays NULL.

      const cutoff = new Date(Date.now() + 60_000);
      const deleted = await blobService.sweepMarked(cutoff);

      expect(deleted).toEqual([]);
      const remaining = await currentDb().select().from(projectBlob);
      expect(remaining).toHaveLength(1);
    });

    it("cancel-on-re-reference: a marked sha that gets re-referenced survives the next sweep", async () => {
      await blobService.store(projectId, fileFromBytes(PNG_BYTES));

      // Step 1: mark (simulating a delete)
      await blobService.refreshMarks(projectId, []);
      expect(await fetchMark(PNG_SHA256)).toBeInstanceOf(Date);

      // Step 2: re-reference (simulating a duplicate-set landing)
      await blobService.refreshMarks(projectId, [PNG_SHA256]);
      expect(await fetchMark(PNG_SHA256)).toBeNull();

      // Step 3: sweep — nothing should be deleted
      const deleted = await blobService.sweepMarked(new Date(Date.now() + 1000));
      expect(deleted).toEqual([]);
      const remaining = await currentDb().select().from(projectBlob);
      expect(remaining).toHaveLength(1);
    });

    it("never marks blobs from another project", async () => {
      const otherOwner = await userFactory.create();
      const otherProject = await projectFactory.create({ ownerUserId: otherOwner.id });
      await blobService.store(otherProject.id, fileFromBytes(PNG_BYTES));

      // refreshMarks for OUR project with an empty ref set — should NOT touch
      // the other project's blob (which is unreferenced from our perspective).
      await blobService.refreshMarks(projectId, []);

      const [other] = await currentDb()
        .select({ pendingGcAt: projectBlob.pendingGcAt })
        .from(projectBlob)
        .where(eq(projectBlob.projectId, otherProject.id));
      expect(other?.pendingGcAt).toBeNull();
    });
  });
});
