import { and, eq } from "drizzle-orm";

import { type Db, type Tx, db as defaultDb } from "../../db";
import { type Project, type ProjectMember, projectMember } from "../../db/app-schema";
import { user } from "../../db/auth-schema";
import { NotFoundError } from "../../errors";
import { type ProjectMembership, type ProjectRole } from "../projects/service";

export type ProjectMemberRole = Exclude<ProjectRole, "owner">;

export interface MemberWithUser {
  member: ProjectMember;
  user: { id: string; name: string; email: string; image: string | null };
}

export class MemberService {
  constructor(private readonly db: Db) {}

  async list(projectId: string): Promise<MemberWithUser[]> {
    return await this.db
      .select({
        member: projectMember,
        user: { id: user.id, name: user.name, email: user.email, image: user.image },
      })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId));
  }

  async ensureMembership(
    tx: Tx,
    proj: Project,
    userId: string,
    desiredRole: ProjectMemberRole
  ): Promise<ProjectMembership> {
    if (proj.ownerUserId === userId) return { project: proj, role: "owner" };

    const [inserted] = await tx
      .insert(projectMember)
      .values({ projectId: proj.id, userId, role: desiredRole })
      .onConflictDoNothing()
      .returning();
    if (inserted) return { project: proj, role: desiredRole };

    const [existing] = await tx
      .select()
      .from(projectMember)
      .where(and(eq(projectMember.projectId, proj.id), eq(projectMember.userId, userId)));
    if (!existing) throw new Error("Failed to upsert member");
    return { project: proj, role: existing.role };
  }

  async remove(projectId: string, userId: string): Promise<ProjectMember> {
    const [removed] = await this.db
      .delete(projectMember)
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
      .returning();

    if (!removed) throw new NotFoundError("Member not found");
    return removed;
  }

  async changeRole(
    projectId: string,
    userId: string,
    newRole: ProjectMemberRole
  ): Promise<ProjectMember> {
    const [updated] = await this.db
      .update(projectMember)
      .set({ role: newRole })
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
      .returning();

    if (!updated) throw new NotFoundError("Member not found");
    return updated;
  }
}

export const memberService = new MemberService(defaultDb);
