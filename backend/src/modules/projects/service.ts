import { ASSETS_KEY, ENTRY_KEY, FILES_KEY, MAIN_PATH, META_KEY } from "@typstogether/shared";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import * as Y from "yjs";

import { collabDocument, type Project, project, projectMember } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { blobService } from "../blobs/service";
import { fetchDocument, storeDocument } from "../collab/persistence";
import { fetchTemplateFiles } from "../templates/files";
import type { CreateProjectInput, ProjectSnapshot, UpdateProjectInput } from "./model";

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectMembership {
  project: Project;
  role: ProjectRole;
}

// A list row also carries the project's content-version (collab_document
// updatedAt, null when no doc has been stored yet) so the dashboard can decide
// whether its cached thumbnail is stale without fetching each project's doc.
export interface ProjectListItem extends ProjectMembership {
  docUpdatedAt: Date | null;
}

export class ProjectService {
  private membershipSelect(userId: string) {
    return currentDb()
      .select({
        project,
        memberRole: projectMember.role,
        docUpdatedAt: collabDocument.updatedAt,
      })
      .from(project)
      .leftJoin(
        projectMember,
        and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
      )
      .leftJoin(collabDocument, eq(collabDocument.projectId, project.id));
  }

  async list(userId: string): Promise<ProjectListItem[]> {
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
      docUpdatedAt: row.docUpdatedAt,
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

  // Decode the persisted Y.Doc into a plain read-only view for callers (e.g. the
  // dashboard) that need a project's files without joining the collab websocket.
  // Authorization is the route's `projectMember` macro; this acts purely by id.
  async snapshot(id: string): Promise<ProjectSnapshot> {
    const state = await fetchDocument(id);
    if (!state) {
      return { entry: MAIN_PATH, files: {}, assets: {} };
    }

    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);

    const files: Record<string, string> = {};
    for (const [path, text] of doc.getMap<Y.Text>(FILES_KEY)) {
      files[path] = text.toJSON();
    }

    const assets: Record<string, string> = {};
    for (const [path, blobId] of doc.getMap<string>(ASSETS_KEY)) {
      assets[path] = blobId;
    }

    const entry = doc.getMap<string>(META_KEY).get(ENTRY_KEY) ?? MAIN_PATH;
    return { entry, files, assets };
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
      const metaMap = doc.getMap<string>(META_KEY);
      doc.transact(() => {
        for (const [path, content] of templateFiles.text) {
          filesMap.set(path, new Y.Text(content));
        }
        for (const [path, blobId] of blobIdByPath) {
          assetsMap.set(path, blobId);
        }
        // Seed the compile entry alongside the files so collaborators pick it
        // up from the doc on first sync. Default (/main.typ) is the frontend's
        // fallback when this key is absent, so we only set it when overriding.
        if (templateFiles.entry) {
          metaMap.set(ENTRY_KEY, templateFiles.entry);
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
