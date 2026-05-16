import { and, eq } from "drizzle-orm";

import { type ProjectBlob, projectBlob } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import type { BlobMeta } from "./model";

export class BlobService {
  // Each upload creates a new row with a fresh blob_id, even if the bytes
  // already exist in this project under a different id.
  async store(projectId: string, file: File): Promise<BlobMeta> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type;
    const size = bytes.byteLength;

    const [row] = await currentDb()
      .insert(projectBlob)
      .values({ projectId, mime, size, bytes })
      .returning();
    if (!row) throw new Error("BlobService.store: insert returned nothing");

    return { id: row.blobId, mime, size };
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
