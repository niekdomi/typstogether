import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import * as Y from "yjs";

import { type Project, project, projectMember } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { storeDocument } from "../collab/persistence";
import { fetchTemplateFiles } from "../templates/files";
import type { CreateProjectInput, UpdateProjectInput } from "./model";

// Must match the frontend's FILES_KEY (see frontend/src/lib/paths.ts).
const FILES_KEY = "files";

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectMembership {
  project: Project;
  role: ProjectRole;
}

export class ProjectService {
  private membershipSelect(userId: string) {
    return currentDb()
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
    const [proj] = await currentDb()
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
    // If a template is requested, fetch its files *before* the insert so that a
    // network failure surfaces as an error rather than an orphan empty project.
    const templateFiles = input.template
      ? await fetchTemplateFiles(input.template.id, input.template.version)
      : null;

    const [created] = await currentDb()
      .insert(project)
      .values({ name: input.name, ownerUserId: userId })
      .returning();

    if (!created) throw new Error("Failed to create project");

    if (templateFiles && templateFiles.files.size > 0) {
      const doc = new Y.Doc();
      const filesMap = doc.getMap<Y.Text>(FILES_KEY);
      doc.transact(() => {
        for (const [path, content] of templateFiles.files) {
          filesMap.set(path, new Y.Text(content));
        }
      });
      await storeDocument(created.id, Y.encodeStateAsUpdate(doc));
    }

    return created;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const [updated] = await currentDb()
      .update(project)
      .set({ name: input.name })
      .where(and(eq(project.id, id), isNull(project.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Project not found");
    return updated;
  }

  async remove(id: string): Promise<Project> {
    const [deleted] = await currentDb()
      .update(project)
      .set({ deletedAt: new Date() })
      .where(and(eq(project.id, id), isNull(project.deletedAt)))
      .returning();

    if (!deleted) throw new NotFoundError("Project not found");
    return deleted;
  }
}

export const projectService = new ProjectService();
