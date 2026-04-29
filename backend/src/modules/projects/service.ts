import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { type Db, type Tx } from "../../db";
import { type Project, project, projectMember } from "../../db/app-schema";
import { currentDb } from "../../db/context";
import { NotFoundError } from "../../errors";
import type { CreateProjectInput } from "./model";

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectMembership {
  project: Project;
  role: ProjectRole;
}

function membershipSelect(db: Db | Tx, userId: string) {
  return db
    .select({ project, memberRole: projectMember.role })
    .from(project)
    .leftJoin(
      projectMember,
      and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
    );
}

export async function list(
  userId: string,
  db: Db | Tx = currentDb()
): Promise<ProjectMembership[]> {
  const rows = await membershipSelect(db, userId)
    .where(
      and(
        isNull(project.deletedAt),
        or(eq(project.ownerUserId, userId), isNotNull(projectMember.userId))
      )
    )
    .orderBy(desc(project.updatedAt));

  return rows.map((row) => ({
    project: row.project,
    role: row.project.ownerUserId === userId ? "owner" : row.memberRole!,
  }));
}

export async function getMembership(
  userId: string,
  id: string,
  db: Db | Tx = currentDb()
): Promise<ProjectMembership> {
  const [row] = await membershipSelect(db, userId).where(
    and(eq(project.id, id), isNull(project.deletedAt))
  );

  if (row) {
    if (row.project.ownerUserId === userId) {
      return { project: row.project, role: "owner" };
    }
    if (row.memberRole) {
      return { project: row.project, role: row.memberRole };
    }
  }

  throw new NotFoundError("Project not found");
}

export async function create(
  userId: string,
  input: CreateProjectInput,
  db: Db | Tx = currentDb()
): Promise<Project> {
  const [created] = await db
    .insert(project)
    .values({ name: input.name, ownerUserId: userId })
    .returning();

  if (!created) throw new Error("Failed to create project");
  return created;
}

export async function remove(id: string, db: Db | Tx = currentDb()): Promise<Project> {
  const [deleted] = await db
    .update(project)
    .set({ deletedAt: new Date() })
    .where(and(eq(project.id, id), isNull(project.deletedAt)))
    .returning();

  if (!deleted) throw new NotFoundError("Project not found");
  return deleted;
}
