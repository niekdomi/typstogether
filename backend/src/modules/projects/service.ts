import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { type Db, db as defaultDb } from "../../db";
import { type Project, project, projectMember } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import type { CreateProjectInput } from "./model";

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectMembership {
  project: Project;
  role: ProjectRole;
}

export class ProjectService {
  constructor(private readonly db: Db) {}

  private membershipSelect(userId: string) {
    return this.db
      .select({ project, memberRole: projectMember.role })
      .from(project)
      .leftJoin(
        projectMember,
        and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
      );
  }

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

  async findActive(id: string): Promise<Project> {
    const [proj] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, id), isNull(project.deletedAt)));
    if (!proj) throw new NotFoundError("Project not found");
    return proj;
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

  async remove(id: string): Promise<Project> {
    const [deleted] = await this.db
      .update(project)
      .set({ deletedAt: new Date() })
      .where(and(eq(project.id, id), isNull(project.deletedAt)))
      .returning();

    if (!deleted) throw new NotFoundError("Project not found");
    return deleted;
  }
}

export const projectService = new ProjectService(defaultDb);
