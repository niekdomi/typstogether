import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { type Db, db as defaultDb } from "../../db";
import { project, projectMember } from "../../db/app-schema";
import type { CreateProjectInput } from "./model";

type AccessLevel = "member" | "owner";

export class ProjectService {
  constructor(private readonly db: Db) {}

  list(userId: string) {
    return this.db
      .select()
      .from(project)
      .where(and(isNull(project.deletedAt), this.accessibleBy(userId)))
      .orderBy(desc(project.updatedAt));
  }

  async findAuthorized(userId: string, id: string, level: AccessLevel) {
    const predicate = level === "owner" ? this.ownedBy(userId) : this.accessibleBy(userId);

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

  private ownedBy(userId: string) {
    return eq(project.ownerUserId, userId);
  }

  private accessibleBy(userId: string) {
    return or(
      this.ownedBy(userId),
      inArray(
        project.id,
        this.db
          .select({ id: projectMember.projectId })
          .from(projectMember)
          .where(eq(projectMember.userId, userId))
      )
    );
  }
}

export const projectService = new ProjectService(defaultDb);
