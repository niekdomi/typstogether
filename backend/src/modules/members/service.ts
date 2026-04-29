import { and, eq } from "drizzle-orm";

import { type Db, type Tx, db as defaultDb } from "../../db";
import { type ProjectMember, projectMember } from "../../db/app-schema";
import { user } from "../../db/auth-schema";
import { ConflictError, NotFoundError } from "../../errors";
import { type ProjectRole } from "../projects/service";

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

  async create(
    tx: Tx,
    projectId: string,
    userId: string,
    role: ProjectMemberRole
  ): Promise<ProjectMember> {
    const [member] = await tx
      .insert(projectMember)
      .values({ projectId, userId, role })
      .onConflictDoNothing()
      .returning();
    if (!member) throw new ConflictError("User is already a member of this project");
    return member;
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
