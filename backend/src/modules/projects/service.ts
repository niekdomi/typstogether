import { and, desc, eq, isNull } from "drizzle-orm";

import { db, type Db } from "../../db";
import { project } from "../../db/app-schema";
import { accessibleBy, ownedBy } from "./access";
import type { CreateProjectInput } from "./model";

type AccessLevel = "member" | "owner";

export class ProjectService {
  constructor(private readonly db: Db) {}

  list(userId: string) {
    return this.db
      .select()
      .from(project)
      .where(and(isNull(project.deletedAt), accessibleBy(this.db, userId)))
      .orderBy(desc(project.updatedAt));
  }

  async findAccessible(userId: string, id: string, level: AccessLevel) {
    const predicate = level === "owner" ? ownedBy(userId) : accessibleBy(this.db, userId);

    const [row] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt), predicate));

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

  async delete(id: string) {
    const [deleted] = await this.db
      .update(project)
      .set({ deletedAt: new Date() })
      .where(and(eq(project.id, id), isNull(project.deletedAt)))
      .returning();

    return deleted;
  }
}

export const projectService = new ProjectService(db);
