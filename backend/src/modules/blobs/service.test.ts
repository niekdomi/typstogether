import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { and, eq } from "drizzle-orm";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { projectBlob } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { blobService } from "./service";

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    it("returns a UUID id, mime, and size; persists the row", async () => {
      const meta = await blobService.store(projectId, fileFromBytes(PNG_BYTES));

      expect(meta.id).toMatch(UUID_RE);
      expect(meta.mime).toBe("image/png");
      expect(meta.size).toBe(PNG_BYTES.byteLength);

      const [row] = await currentDb()
        .select()
        .from(projectBlob)
        .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.blobId, meta.id)));
      expect(row?.bytes).toEqual(PNG_BYTES);
    });

    it("creates two distinct rows for two uploads of the same content (no dedup)", async () => {
      const first = await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      const second = await blobService.store(projectId, fileFromBytes(PNG_BYTES));

      expect(first.id).not.toBe(second.id);

      const rows = await currentDb()
        .select()
        .from(projectBlob)
        .where(eq(projectBlob.projectId, projectId));
      expect(rows.length).toBe(2);
    });

    it("scopes blobs per project", async () => {
      const otherOwner = await userFactory.create();
      const otherProject = await projectFactory.create({ ownerUserId: otherOwner.id });

      await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      await blobService.store(otherProject.id, fileFromBytes(PNG_BYTES));

      const ours = await currentDb()
        .select()
        .from(projectBlob)
        .where(eq(projectBlob.projectId, projectId));
      expect(ours.length).toBe(1);
    });
  });

  describe("fetch", () => {
    it("returns the stored blob by id", async () => {
      const meta = await blobService.store(projectId, fileFromBytes(PNG_BYTES));
      const blob = await blobService.fetch(projectId, meta.id);

      expect(blob.bytes).toEqual(PNG_BYTES);
      expect(blob.mime).toBe("image/png");
      expect(blob.size).toBe(PNG_BYTES.byteLength);
    });

    it("throws NotFoundError when the id is missing in this project", async () => {
      const notExistsId = crypto.randomUUID();
      await expectThrows(() => blobService.fetch(projectId, notExistsId), NotFoundError);
    });

    it("does not return blobs from another project", async () => {
      const otherOwner = await userFactory.create();
      const otherProject = await projectFactory.create({ ownerUserId: otherOwner.id });
      const meta = await blobService.store(otherProject.id, fileFromBytes(PNG_BYTES));

      await expectThrows(() => blobService.fetch(projectId, meta.id), NotFoundError);
    });
  });

  describe("deleteBlob", () => {
    it("deletes the row identified by (projectId, blobId)", async () => {
      const meta = await blobService.store(projectId, fileFromBytes(PNG_BYTES));

      await blobService.deleteBlob(projectId, meta.id);

      const rows = await currentDb()
        .select()
        .from(projectBlob)
        .where(eq(projectBlob.projectId, projectId));
      expect(rows).toEqual([]);
    });

    it("is a no-op when the row doesn't exist", async () => {
      await blobService.deleteBlob(projectId, crypto.randomUUID());
      const rows = await currentDb().select().from(projectBlob);
      expect(rows).toEqual([]);
    });

    it("never deletes blobs from another project even with the same blobId", async () => {
      // The (project_id, blob_id) PK means the same blobId could only collide
      // by random chance, but the WHERE clause must still scope by project.
      const otherOwner = await userFactory.create();
      const otherProject = await projectFactory.create({ ownerUserId: otherOwner.id });
      const otherMeta = await blobService.store(otherProject.id, fileFromBytes(PNG_BYTES));

      await blobService.deleteBlob(projectId, otherMeta.id);

      const otherRows = await currentDb()
        .select()
        .from(projectBlob)
        .where(eq(projectBlob.projectId, otherProject.id));
      expect(otherRows.length).toBe(1);
    });
  });
});
