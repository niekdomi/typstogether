import { and, eq, isNull, or } from "drizzle-orm";
import { status } from "elysia";

import { db as defaultDb } from "../../db";
import { project, projectMember } from "../../db/app-schema";
import type { CreateProjectInput } from "./model";

type Db = typeof defaultDb;

export class ProjectService {
  constructor(private readonly db: Db) {}

  list(userId: string) {
    return this.db
      .select({ project })
      .from(project)
      .leftJoin(projectMember, eq(project.id, projectMember.projectId))
      .where(
        and(
          isNull(project.deletedAt),
          or(eq(project.ownerUserId, userId), eq(projectMember.userId, userId))
        )
      );
  }

  async get(userId: string, id: string) {
    const [row] = await this.db
      .select({ project })
      .from(project)
      .leftJoin(projectMember, eq(project.id, projectMember.projectId))
      .where(
        and(
          eq(project.id, id),
          isNull(project.deletedAt),
          or(eq(project.ownerUserId, userId), eq(projectMember.userId, userId))
        )
      )
      .limit(1);

    if (!row) {
      return status(404, "Project not found");
    }

    return row.project;
  }

  async create(userId: string, input: CreateProjectInput) {
    const id = crypto.randomUUID();

    const [created] = await this.db
      .insert(project)
      .values({ id, name: input.name, ownerUserId: userId })
      .returning();

    return created;
  }

  async delete(userId: string, id: string) {
    const [deleted] = await this.db
      .update(project)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(project.id, id), eq(project.ownerUserId, userId), isNull(project.deletedAt))
      )
      .returning({ id: project.id });

    if (!deleted) {
      return status(404, "Project not found");
    }

    return { success: true };
  }
}

export const projectService = new ProjectService(defaultDb);
