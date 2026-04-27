import { and, eq, isNull, or } from "drizzle-orm";
import { Elysia, status, t } from "elysia";

import { requireAuth } from "../auth/middleware";
import { db } from "../db";
import { project, projectMember } from "../db/app-schema";

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .use(requireAuth)

  .get("/", async ({ user }) =>
    db
      .select({ project })
      .from(project)
      .leftJoin(projectMember, eq(project.id, projectMember.projectId))
      .where(
        and(
          isNull(project.deletedAt),
          or(eq(project.ownerUserId, user.id), eq(projectMember.userId, user.id))
        )
      )
  )

  .get("/:id", async ({ user, params }) => {
    const [row] = await db
      .select({ project })
      .from(project)
      .leftJoin(projectMember, eq(project.id, projectMember.projectId))
      .where(
        and(
          eq(project.id, params.id),
          isNull(project.deletedAt),
          or(eq(project.ownerUserId, user.id), eq(projectMember.userId, user.id))
        )
      )
      .limit(1);

    if (!row) {
      return status(404, "Project not found");
    }

    return row.project;
  })

  .post(
    "/",
    async ({ user, body }) => {
      const id = crypto.randomUUID();

      const [created] = await db
        .insert(project)
        .values({ id, name: body.name, ownerUserId: user.id })
        .returning();

      return created;
    },
    { body: t.Object({ name: t.String({ minLength: 1 }) }) }
  )

  .delete("/:id", async ({ user, params }) => {
    const [deleted] = await db
      .update(project)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(project.id, params.id), eq(project.ownerUserId, user.id), isNull(project.deletedAt))
      )
      .returning({ id: project.id });

    if (!deleted) {
      return status(404, "Project not found");
    }

    return { success: true };
  });
