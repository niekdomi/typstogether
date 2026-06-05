import { and, eq } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";

import { type ProjectBlob, projectBlob } from "../../db/app-schema";
import { NotFoundError, UnsupportedMediaTypeError } from "../../errors";
import { currentDb } from "../../transaction";
import { ALLOWED_MIME_TYPES, type BlobMeta, FONT_MIMES } from "./model";

export class BlobService {
  // Each call creates a new row with a fresh blob_id, even if identical bytes
  // already exist in this project under a different id.
  async storeBytes(projectId: string, bytes: Uint8Array, mime: string): Promise<BlobMeta> {
    const size = bytes.byteLength;
    const [row] = await currentDb()
      .insert(projectBlob)
      .values({ projectId, mime, size, bytes })
      .returning();
    if (!row) throw new Error("BlobService.storeBytes: insert returned nothing");

    return { id: row.blobId, mime, size };
  }

  async store(projectId: string, file: File): Promise<BlobMeta> {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      throw new UnsupportedMediaTypeError(`Unsupported mime type: ${file.type}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return this.storeBytes(projectId, bytes, file.type);
  }

  // Browser-supplied font MIME is unreliable, so detect by magic number with
  // file-type (the lib Elysia's `t.File` uses): one call validates the upload and
  // yields the canonical mime to store.
  async storeFont(projectId: string, file: File): Promise<BlobMeta> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(bytes);
    if (!detected || !FONT_MIMES.has(detected.mime)) {
      throw new UnsupportedMediaTypeError("Not a TTF, OTF, or TTC font");
    }
    return this.storeBytes(projectId, bytes, detected.mime);
  }

  async fetch(projectId: string, blobId: string): Promise<ProjectBlob> {
    const [row] = await currentDb()
      .select()
      .from(projectBlob)
      .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.blobId, blobId)));
    if (!row) throw new NotFoundError("Blob not found");
    return row;
  }

  // Idempotent, no-op if the row was already deleted (or never existed).
  async deleteBlob(projectId: string, blobId: string): Promise<void> {
    await currentDb()
      .delete(projectBlob)
      .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.blobId, blobId)));
  }
}

export const blobService = new BlobService();
