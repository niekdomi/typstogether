import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import * as Y from "yjs";

import { type Project, project, projectMember } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { blobService } from "../blobs/service";
import { storeDocument } from "../collab/persistence";
import { fetchTemplateFiles } from "../templates/files";
import type { CreateProjectInput, UpdateProjectInput } from "./model";

// Must match the frontend's keys (see frontend/src/lib/paths.ts).
const FILES_KEY = "files";
const ASSETS_KEY = "assets";

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
      .values({
        name: input.name,
        ownerUserId: userId,
        // Templates declare their entry in typst.toml; respect it when set,
        // otherwise let the column default (/main.typ) take over.
        ...(templateFiles?.entry ? { entry: templateFiles.entry } : {}),
      })
      .returning();

    if (!created) throw new Error("Failed to create project");

    if (templateFiles && (templateFiles.text.size > 0 || templateFiles.binary.size > 0)) {
      // Persist each binary entry as a project_blob row first so we can wire
      // its assigned id into the assets Y.Map alongside the text files.
      const blobIdByPath = new Map<string, string>();
      for (const [path, { bytes, mime }] of templateFiles.binary) {
        const { id } = await blobService.storeBytes(created.id, bytes, mime);
        blobIdByPath.set(path, id);
      }

      const doc = new Y.Doc();
      const filesMap = doc.getMap<Y.Text>(FILES_KEY);
      const assetsMap = doc.getMap<string>(ASSETS_KEY);
      doc.transact(() => {
        for (const [path, content] of templateFiles.text) {
          filesMap.set(path, new Y.Text(content));
        }
        for (const [path, blobId] of blobIdByPath) {
          assetsMap.set(path, blobId);
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
