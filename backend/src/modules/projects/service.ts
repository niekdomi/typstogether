import { type InferSelectModel, and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { type Db, db as defaultDb } from "../../db";
import { project, projectMember } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import type { CreateProjectInput } from "./model";

export type Project = InferSelectModel<typeof project>;

export class ProjectService {
  constructor(private readonly db: Db) {}

  async list(userId: string): Promise<Project[]> {
    return await this.db
      .select()
      .from(project)
      .where(and(isNull(project.deletedAt), this.accessibleBy(userId)))
      .orderBy(desc(project.updatedAt));
  }

  async getAccessibleBy(userId: string, id: string): Promise<Project> {
    const [row] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt), this.accessibleBy(userId)));

    if (!row) {
      throw new NotFoundError("Project not found");
    }
    return row;
  }

  async getOwnedBy(userId: string, id: string): Promise<Project> {
    const [row] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt), this.ownedBy(userId)));

    if (!row) {
      throw new NotFoundError("Project not found");
    }
    return row;
  }

  async create(userId: string, input: CreateProjectInput): Promise<Project | undefined> {
    const id = crypto.randomUUID();

    const [created] = await this.db
      .insert(project)
      .values({ id, name: input.name, ownerUserId: userId })
      .returning();

    return created;
  }

  async delete(id: string): Promise<Project> {
    const [deleted] = await this.db
      .update(project)
      .set({ deletedAt: new Date() })
      .where(and(eq(project.id, id), isNull(project.deletedAt)))
      .returning();

    if (!deleted) {
      throw new NotFoundError("Project not found");
    }
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
