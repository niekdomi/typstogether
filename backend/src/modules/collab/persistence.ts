import { Database } from "@hocuspocus/extension-database";
import { eq } from "drizzle-orm";

import { collabDocument } from "../../db/app-schema";
import { currentDb } from "../../transaction";

export async function fetchDocument(projectId: string): Promise<Uint8Array | null> {
  const [row] = await currentDb()
    .select({ state: collabDocument.state })
    .from(collabDocument)
    .where(eq(collabDocument.projectId, projectId));

  return row?.state ?? null;
}

export async function storeDocument(projectId: string, state: Uint8Array): Promise<void> {
  await currentDb()
    .insert(collabDocument)
    .values({ projectId, state })
    .onConflictDoUpdate({
      target: collabDocument.projectId,
      set: { state, updatedAt: new Date() },
    });
}

export const persistence = new Database({
  fetch: ({ documentName }) => fetchDocument(documentName),
  store: ({ documentName, state }) => storeDocument(documentName, state),
});
