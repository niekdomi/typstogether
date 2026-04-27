import { Elysia, t } from "elysia";
import { and, eq, isNull, or } from "drizzle-orm";
import { sessionMiddleware } from "../auth/middleware";
import { db } from "../db";
import { project, projectMember } from "../db/app-schema";

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .use(sessionMiddleware)
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return "Unauthorized";
    }

    return db
      .select({ project })
      .from(project)
      .leftJoin(projectMember, eq(project.id, projectMember.projectId))
      .where(
        and(
          isNull(project.deletedAt),
          or(eq(project.ownerUserId, user.id), eq(projectMember.userId, user.id))
        )
      );
  })

  .get("/:id", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return "Unauthorized";
    }

    const [row] = await db
      .select()
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
      set.status = 404;
      return "Project not found";
    }

    return row.project;
  })

  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return "Unauthorized";
      }

      const id = crypto.randomUUID();

      const [created] = await db
        .insert(project)
        .values({ id, name: body.name, ownerUserId: user.id })
        .returning();

      return created;
    },
    { body: t.Object({ name: t.String({ minLength: 1 }) }) }
  )

  .delete("/:id", async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return "Unauthorized";
    }

    const [row] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, params.id), isNull(project.deletedAt)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return "Project not found";
    }

    if (row.ownerUserId !== user.id) {
      set.status = 403;
      return "Forbidden";
    }

    await db.update(project).set({ deletedAt: new Date() }).where(eq(project.id, params.id));

    return { success: true };
  });
