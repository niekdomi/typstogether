import { and, eq, isNull } from "drizzle-orm";

import { type ProjectInvite, projectInvite, projectMember } from "../../db/app-schema";
import { GoneError, NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { memberService } from "../members/service";
import { type ProjectMembership, projectService } from "../projects/service";
import type { CreateInviteInput } from "./model";

export interface CreateInviteArgs extends CreateInviteInput {
  projectId: string;
  createdByUserId: string;
}

export interface CreatedInvite {
  invite: ProjectInvite;
  token: string;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export class InviteService {
  async list(projectId: string): Promise<ProjectInvite[]> {
    return await currentDb()
      .select()
      .from(projectInvite)
      .where(eq(projectInvite.projectId, projectId));
  }

  async create(args: CreateInviteArgs): Promise<CreatedInvite> {
    const token = generateToken();
    const tokenHash = hashToken(token);

    const [invite] = await currentDb()
      .insert(projectInvite)
      .values({ ...args, tokenHash })
      .returning();

    if (!invite) throw new Error("Failed to create invite");
    return { invite, token };
  }

  async revoke(projectId: string, inviteId: string): Promise<ProjectInvite> {
    const [revoked] = await currentDb()
      .update(projectInvite)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(projectInvite.id, inviteId),
          eq(projectInvite.projectId, projectId),
          isNull(projectInvite.revokedAt)
        )
      )
      .returning();

    if (!revoked) throw new NotFoundError("Invite not found");
    return revoked;
  }

  async redeem(userId: string, token: string): Promise<ProjectMembership> {
    const tokenHash = hashToken(token);

    const [invite] = await currentDb()
      .select()
      .from(projectInvite)
      .where(eq(projectInvite.tokenHash, tokenHash));

    if (!invite) throw new NotFoundError("Invite not found");

    if (invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new GoneError("Invite is no longer valid");
    }

    const project = await projectService.findActive(invite.projectId);

    if (project.ownerUserId === userId) {
      return { project, role: "owner" };
    }

    const [existing] = await currentDb()
      .select()
      .from(projectMember)
      .where(and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId)));
    if (existing) return { project, role: existing.role };

    await memberService.create(project.id, userId, invite.role);
    return { project, role: invite.role };
  }
}

export const inviteService = new InviteService();
