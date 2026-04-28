import { and, eq, inArray, isNull, or } from "drizzle-orm";

import type { Db } from "../../db";
import { project, projectMember } from "../../db/app-schema";

const memberProjectIds = (db: Db, userId: string) =>
  db
    .select({ id: projectMember.projectId })
    .from(projectMember)
    .where(eq(projectMember.userId, userId));

export const accessibleBy = (db: Db, userId: string) =>
  or(eq(project.ownerUserId, userId), inArray(project.id, memberProjectIds(db, userId)));

export const hasAccess = async (db: Db, userId: string, projectId: string) => {
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), isNull(project.deletedAt), accessibleBy(db, userId)));
  return Boolean(row);
};

export const isOwner = async (db: Db, userId: string, projectId: string) => {
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(
      and(eq(project.id, projectId), eq(project.ownerUserId, userId), isNull(project.deletedAt))
    );
  return Boolean(row);
};
