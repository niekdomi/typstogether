import { Database } from "@hocuspocus/extension-database";
import { eq } from "drizzle-orm";

import { currentDb } from "../../transaction";
import { collabDocument } from "../../db/app-schema";

export const persistence = new Database({
  async fetch({ documentName }) {
    const [row] = await currentDb()
      .select({ state: collabDocument.state })
      .from(collabDocument)
      .where(eq(collabDocument.projectId, documentName));

    return row?.state ?? null;
  },

  async store({ documentName, state }) {
    await currentDb()
      .insert(collabDocument)
      .values({ projectId: documentName, state })
      .onConflictDoUpdate({
        target: collabDocument.projectId,
        set: { state, updatedAt: new Date() },
      });
  },
});
