import { and, eq } from "drizzle-orm";

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
}

export const blobService = new BlobService();
