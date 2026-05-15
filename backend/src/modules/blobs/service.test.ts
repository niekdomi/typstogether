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
});
