import { eq, inArray, isNull, or } from "drizzle-orm";

import type { Db } from "../../db";
import { project, projectMember } from "../../db/app-schema";

export const notDeleted = () => isNull(project.deletedAt);
export const withId = (id: string) => eq(project.id, id);
export const ownedBy = (userId: string) => eq(project.ownerUserId, userId);

const memberProjectIds = (db: Db, userId: string) =>
  db
    .select({ id: projectMember.projectId })
    .from(projectMember)
    .where(eq(projectMember.userId, userId));

export const accessibleBy = (db: Db, userId: string) =>
  or(ownedBy(userId), inArray(project.id, memberProjectIds(db, userId)));
