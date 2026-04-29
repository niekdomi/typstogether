import { and, eq, isNull } from "drizzle-orm";

import { type Db, type Tx } from "../../db";
import { type ProjectInvite, projectInvite } from "../../db/app-schema";
import { currentDb } from "../../db/context";
import { ConflictError, GoneError, NotFoundError } from "../../errors";
import * as members from "../members/service";
import * as projects from "../projects/service";
import { type ProjectMembership } from "../projects/service";
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

export async function list(projectId: string, db: Db | Tx = currentDb()): Promise<ProjectInvite[]> {
  return await db.select().from(projectInvite).where(eq(projectInvite.projectId, projectId));
}

export async function create(
  args: CreateInviteArgs,
  db: Db | Tx = currentDb()
): Promise<CreatedInvite> {
  const token = generateToken();
  const tokenHash = hashToken(token);

  const [invite] = await db
    .insert(projectInvite)
    .values({ ...args, tokenHash })
    .returning();

  if (!invite) throw new Error("Failed to create invite");
  return { invite, token };
}

export async function revoke(
  projectId: string,
  inviteId: string,
  db: Db | Tx = currentDb()
): Promise<ProjectInvite> {
  const [revoked] = await db
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

export async function redeem(
  userId: string,
  token: string,
  db: Db | Tx = currentDb()
): Promise<ProjectMembership> {
  const tokenHash = hashToken(token);

  const [invite] = await db
    .select()
    .from(projectInvite)
    .where(eq(projectInvite.tokenHash, tokenHash));

  if (!invite) throw new NotFoundError("Invite not found");

  if (invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
    throw new GoneError("Invite is no longer valid");
  }

  const proj = await projects.findActive(invite.projectId, db);

  if (proj.ownerUserId === userId) {
    throw new ConflictError("You already own this project");
  }

  await members.create(proj.id, userId, invite.role, db);
  return { project: proj, role: invite.role };
}
