import { and, desc, eq, isNull } from "drizzle-orm";
import { status } from "elysia";

import { db, type Db } from "../../db";
import { project } from "../../db/app-schema";
import { accessibleBy } from "./access";
import type { CreateProjectInput } from "./model";

export class ProjectService {
  constructor(private readonly db: Db) {}

  list(userId: string) {
    return this.db
      .select()
      .from(project)
      .where(and(isNull(project.deletedAt), accessibleBy(this.db, userId)))
      .orderBy(desc(project.updatedAt));
  }

  async get(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt), accessibleBy(this.db, userId)));

    if (!row) {
      return status(404, "Project not found");
    }

    return row;
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
      .where(and(eq(project.id, id), eq(project.ownerUserId, userId), isNull(project.deletedAt)))
      .returning({ id: project.id });

    if (!deleted) {
      return status(404, "Project not found");
    }

    return { success: true };
  }
}

export const projectService = new ProjectService(db);
