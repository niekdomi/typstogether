import { and, eq, inArray, isNotNull, isNull, lt, not } from "drizzle-orm";

import { type ProjectBlob, projectBlob } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import type { BlobMeta } from "./model";

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

  // Sync the per-row `pending_gc_at` marks to the live reference set:
  //   - unreferenced blobs not already marked → set NOW()
  //   - referenced blobs that ARE marked → clear (cancel the mark)
  // Idempotent. Called from the GC extension on doc load and on every assets
  // map mutation. Never deletes — the sweeper does that after the delay.
  async refreshMarks(projectId: string, referencedShas: Iterable<string>): Promise<void> {
    const refs = [...new Set(referencedShas)];
    const db = currentDb();

    // Mark unreferenced blobs that aren't already pending.
    const markConditions = [eq(projectBlob.projectId, projectId), isNull(projectBlob.pendingGcAt)];
    if (refs.length > 0) {
      markConditions.push(not(inArray(projectBlob.sha256, refs)));
    }
    await db
      .update(projectBlob)
      .set({ pendingGcAt: new Date() })
      .where(and(...markConditions));

    // Cancel marks for blobs that are now referenced.
    if (refs.length > 0) {
      await db
        .update(projectBlob)
        .set({ pendingGcAt: null })
        .where(
          and(
            eq(projectBlob.projectId, projectId),
            isNotNull(projectBlob.pendingGcAt),
            inArray(projectBlob.sha256, refs)
          )
        );
    }
  }

  async sweepMarked(olderThan: Date): Promise<string[]> {
    const deleted = await currentDb()
      .delete(projectBlob)
      .where(and(isNotNull(projectBlob.pendingGcAt), lt(projectBlob.pendingGcAt, olderThan)))
      .returning();
    return deleted.map((row) => row.sha256);
  }
}

export const blobService = new BlobService();
