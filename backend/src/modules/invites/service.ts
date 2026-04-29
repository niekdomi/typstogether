import { and, eq, isNull } from "drizzle-orm";

import { type Db, db as defaultDb } from "../../db";
import { type ProjectInvite, project, projectInvite } from "../../db/app-schema";
import { GoneError, NotFoundError } from "../../errors";
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
  constructor(private readonly db: Db) {}

  async list(projectId: string): Promise<ProjectInvite[]> {
    return await this.db.select().from(projectInvite).where(eq(projectInvite.projectId, projectId));
  }

  async create(args: CreateInviteArgs): Promise<CreatedInvite> {
    const token = generateToken();
    const tokenHash = hashToken(token);

    const [invite] = await this.db
      .insert(projectInvite)
      .values({ ...args, tokenHash })
      .returning();

    if (!invite) throw new Error("Failed to create invite");
    return { invite, token };
  }

  async revoke(projectId: string, inviteId: string): Promise<ProjectInvite> {
    const [revoked] = await this.db
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

    return await this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(projectInvite)
        .where(eq(projectInvite.tokenHash, tokenHash));

      if (!invite) throw new NotFoundError("Invite not found");

      if (invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
        throw new GoneError("Invite is no longer valid");
      }

      const [proj] = await tx
        .select()
        .from(project)
        .where(and(eq(project.id, invite.projectId), isNull(project.deletedAt)));

      if (!proj) throw new NotFoundError("Invite project not found");

      return await projectService.ensureMembership(tx, proj, userId, invite.role);
    });
  }
}

export const inviteService = new InviteService(defaultDb);
