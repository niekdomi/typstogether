import { type InferSelectModel, and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { type Db, db as defaultDb } from "../../db";
import { project, projectMember } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import type { CreateProjectInput } from "./model";

export type Project = InferSelectModel<typeof project>;

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectMembership {
  project: Project;
  role: ProjectRole;
}

export class ProjectService {
  constructor(private readonly db: Db) {}

  async list(userId: string): Promise<ProjectMembership[]> {
    const rows = await this.membershipSelect(userId)
      .where(
        and(
          isNull(project.deletedAt),
          or(eq(project.ownerUserId, userId), isNotNull(projectMember.userId))
        )
      )
      .orderBy(desc(project.updatedAt));

    return rows.map((row) => ({
      project: row.project,
      role: row.project.ownerUserId === userId ? "owner" : row.memberRole!,
    }));
  }

  async getMembership(userId: string, id: string): Promise<ProjectMembership> {
    const [row] = await this.membershipSelect(userId).where(
      and(eq(project.id, id), isNull(project.deletedAt))
    );

    if (row) {
      if (row.project.ownerUserId === userId) {
        return { project: row.project, role: "owner" };
      }
      if (row.memberRole) {
        return { project: row.project, role: row.memberRole };
      }
    }

    throw new NotFoundError("Project not found");
  }

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    const [created] = await this.db
      .insert(project)
      .values({ name: input.name, ownerUserId: userId })
      .returning();

    if (!created) throw new Error("Failed to create project");
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

  private membershipSelect(userId: string) {
    return this.db
      .select({ project, memberRole: projectMember.role })
      .from(project)
      .leftJoin(
        projectMember,
        and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
      );
  }
}

export const projectService = new ProjectService(defaultDb);
