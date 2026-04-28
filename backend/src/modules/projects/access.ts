import { eq, inArray, or } from "drizzle-orm";

import type { Db } from "../../db";
import { project, projectMember } from "../../db/app-schema";

export const ownedBy = (userId: string) => eq(project.ownerUserId, userId);

export const accessibleBy = (db: Db, userId: string) =>
  or(
    ownedBy(userId),
    inArray(
      project.id,
      db
        .select({ id: projectMember.projectId })
        .from(projectMember)
        .where(eq(projectMember.userId, userId))
    )
  );
