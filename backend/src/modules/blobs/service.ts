import { and, eq, inArray, lt, not } from "drizzle-orm";

import { type ProjectBlob, projectBlob } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import type { BlobMeta } from "./model";

const DEFAULT_GC_GRACE_SECONDS = 30;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class BlobService {
  async store(projectId: string, file: File): Promise<BlobMeta> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const mime = file.type;
    const size = bytes.byteLength;

    await currentDb()
      .insert(projectBlob)
      .values({ projectId, sha256, mime, size, bytes })
      .onConflictDoNothing();

    return { sha256, mime, size };
  }

  async fetch(projectId: string, sha256: string): Promise<ProjectBlob> {
    const [row] = await currentDb()
      .select()
      .from(projectBlob)
      .where(and(eq(projectBlob.projectId, projectId), eq(projectBlob.sha256, sha256)));
    if (!row) throw new NotFoundError("Blob not found");
    return row;
  }

  // Garbage-collect blobs in `projectId` whose sha256 isn't in `referencedShas`.
  // A grace window protects blobs from concurrent uploads racing against
  // deletes (a duplicate-set in one client landing after a delete in another):
  // blobs younger than `graceSeconds` are never GC'd. Returns deleted sha256s.
  async gcProject(
    projectId: string,
    referencedShas: Iterable<string>,
    graceSeconds = DEFAULT_GC_GRACE_SECONDS
  ): Promise<string[]> {
    const refs = [...new Set(referencedShas)];
    const conditions = [eq(projectBlob.projectId, projectId)];
    if (graceSeconds > 0) {
      conditions.push(lt(projectBlob.createdAt, new Date(Date.now() - graceSeconds * 1000)));
    }
    if (refs.length > 0) {
      conditions.push(not(inArray(projectBlob.sha256, refs)));
    }
    const deleted = await currentDb()
      .delete(projectBlob)
      .where(and(...conditions))
      .returning();
    return deleted.map((row) => row.sha256);
  }
}

export const blobService = new BlobService();
