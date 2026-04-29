import { and, eq } from "drizzle-orm";

import { type Db, type Tx } from "../../db";
import { type ProjectMember, projectMember } from "../../db/app-schema";
import { user } from "../../db/auth-schema";
import { currentDb } from "../../db/context";
import { ConflictError, NotFoundError } from "../../errors";
import { type ProjectRole } from "../projects/service";

export type ProjectMemberRole = Exclude<ProjectRole, "owner">;

export interface MemberWithUser {
  member: ProjectMember;
  user: { id: string; name: string; email: string; image: string | null };
}

export async function list(
  projectId: string,
  db: Db | Tx = currentDb()
): Promise<MemberWithUser[]> {
  return await db
    .select({
      member: projectMember,
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(eq(projectMember.projectId, projectId));
}

export async function create(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
  db: Db | Tx = currentDb()
): Promise<ProjectMember> {
  const [member] = await db
    .insert(projectMember)
    .values({ projectId, userId, role })
    .onConflictDoNothing()
    .returning();
  if (!member) throw new ConflictError("User is already a member of this project");
  return member;
}

export async function remove(
  projectId: string,
  userId: string,
  db: Db | Tx = currentDb()
): Promise<ProjectMember> {
  const [removed] = await db
    .delete(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning();

  if (!removed) throw new NotFoundError("Member not found");
  return removed;
}

export async function changeRole(
  projectId: string,
  userId: string,
  newRole: ProjectMemberRole,
  db: Db | Tx = currentDb()
): Promise<ProjectMember> {
  const [updated] = await db
    .update(projectMember)
    .set({ role: newRole })
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning();

  if (!updated) throw new NotFoundError("Member not found");
  return updated;
}
