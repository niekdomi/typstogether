import { auth } from "../auth";
import type { onAuthenticatePayload } from "@hocuspocus/server";
import { db } from "../db";
import { project, projectMember } from "../db/app-schema";
import { and, eq, isNull, or } from "drizzle-orm";

export async function onAuthenticate(data: onAuthenticatePayload) {
  const session = await auth.api.getSession({ headers: data.requestHeaders });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const [row] = await db
    .select({ ownerUserId: project.ownerUserId, memberRole: projectMember.role })
    .from(project)
    .leftJoin(
      projectMember,
      and(eq(projectMember.projectId, project.id), eq(projectMember.userId, session.user.id))
    )
    .where(
      and(
        eq(project.id, data.documentName),
        isNull(project.deletedAt),
        or(eq(project.ownerUserId, session.user.id), eq(projectMember.userId, session.user.id))
      )
    )
    .limit(1);

  if (!row) {
    throw new Error("Forbidden");
  }

  const isOwner = row.ownerUserId === session.user.id;
  if (!isOwner && row.memberRole === "viewer") {
    data.connectionConfig.readOnly = true;
  }

  return { userId: session.user.id };
}
