import { Database } from "@hocuspocus/extension-database";
import { db } from "../db";
import { collabDocument } from "../db/app-schema";
import { eq } from "drizzle-orm";

export const persistance = new Database({
  async fetch({ documentName }) {
    const [row] = await db
      .select({ state: collabDocument.state })
      .from(collabDocument)
      .where(eq(collabDocument.projectId, documentName))
      .limit(1);

    return row?.state ?? null;
  },

  async store({ documentName, state }) {
    await db
      .insert(collabDocument)
      .values({ projectId: documentName, state })
      .onConflictDoUpdate({
        target: collabDocument.projectId,
        set: { state, updatedAt: new Date() },
      });
  },
});
