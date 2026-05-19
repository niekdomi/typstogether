import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";
import { createTarGzip, type TarFileInput } from "nanotar";
import * as Y from "yjs";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { project as projectTable, projectBlob } from "../../db/app-schema";
import { NotFoundError } from "../../errors";
import { currentDb } from "../../transaction";
import { fetchDocument } from "../collab/persistence";
import { memberService } from "../members/service";
import { projectService } from "./service";

afterEach(cleanDb);

const FILES_KEY = "files";
const ASSETS_KEY = "assets";
const META_KEY = "meta";

async function mockTemplateTarball(entries: TarFileInput[]) {
  const body = await createTarGzip(entries);
  globalThis.fetch = mock(() => Promise.resolve(new Response(body))) as unknown as typeof fetch;
}

function mockTemplateFetchFailure(status = 404) {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response("nope", { status }))
  ) as unknown as typeof fetch;
}

describe("ProjectService.list", () => {
  test("returns empty when the user has no projects", async () => {
    const user = await userFactory.create();

    const result = await projectService.list(user.id);

    expect(result).toEqual([]);
  });

  test("returns owned projects with role 'owner'", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const result = await projectService.list(owner.id);

    expect(result).toHaveLength(1);
    expect(result[0]!.project.id).toBe(project.id);
    expect(result[0]!.role).toBe("owner");
  });

  test("returns projects the user is a member of with their member role", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "viewer");

    const result = await projectService.list(member.id);

    expect(result).toHaveLength(1);
    expect(result[0]!.project.id).toBe(project.id);
    expect(result[0]!.role).toBe("viewer");
  });

  test("excludes soft-deleted projects", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);

    const result = await projectService.list(owner.id);

    expect(result).toEqual([]);
  });

  test("excludes projects the user has no relationship with", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    await projectFactory.create({ ownerUserId: owner.id });

    const result = await projectService.list(stranger.id);

    expect(result).toEqual([]);
  });

  test("orders by updatedAt descending", async () => {
    const owner = await userFactory.create();
    const older = await projectFactory.create({
      ownerUserId: owner.id,
      updatedAt: new Date("2025-01-01"),
    });
    const newer = await projectFactory.create({
      ownerUserId: owner.id,
      updatedAt: new Date("2025-06-01"),
    });

    const result = await projectService.list(owner.id);

    expect(result.map((r) => r.project.id)).toEqual([newer.id, older.id]);
  });
});

describe("ProjectService.findActive", () => {
  test("returns the project when it exists and is not deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const result = await projectService.findActive(project.id);

    expect(result.id).toBe(project.id);
  });

  test("throws NotFoundError when the project does not exist", async () => {
    await expectThrows(() => projectService.findActive(crypto.randomUUID()), NotFoundError);
  });

  test("throws NotFoundError when the project is soft-deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);

    await expectThrows(() => projectService.findActive(project.id), NotFoundError);
  });
});

describe("ProjectService.getMembership", () => {
  test("returns role 'owner' for the project owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const result = await projectService.getMembership(owner.id, project.id);

    expect(result.role).toBe("owner");
    expect(result.project.id).toBe(project.id);
  });

  test("returns the member role for a project member", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "editor");

    const result = await projectService.getMembership(member.id, project.id);

    expect(result.role).toBe("editor");
  });

  test("throws NotFoundError when the user is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    await expectThrows(() => projectService.getMembership(stranger.id, project.id), NotFoundError);
  });

  test("throws NotFoundError when the project is soft-deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);

    await expectThrows(() => projectService.getMembership(owner.id, project.id), NotFoundError);
  });
});

describe("ProjectService.create", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("creates a project owned by the given user", async () => {
    const owner = await userFactory.create();

    const result = await projectService.create(owner.id, { name: "My Project" });

    expect(result.name).toBe("My Project");
    expect(result.ownerUserId).toBe(owner.id);
    expect(result.deletedAt).toBeNull();
  });

  test("does not seed a collab_document when no template is given", async () => {
    const owner = await userFactory.create();

    const created = await projectService.create(owner.id, { name: "Blank" });

    // Blank projects start with no doc state at all; the client seeds the
    // default file (and the frontend defaults the entry to /main.typ) on
    // first connect.
    expect(await fetchDocument(created.id)).toBeNull();
  });

  test("seeds the template's declared entrypoint into the doc's meta map", async () => {
    const owner = await userFactory.create();
    await mockTemplateTarball([
      {
        name: "typst.toml",
        data: '[package]\nname = "foo"\n\n[template]\npath = "template"\nentrypoint = "report.typ"\n',
      },
      { name: "template/report.typ", data: "= Report" },
    ]);

    const created = await projectService.create(owner.id, {
      name: "Templated",
      template: { id: "foo", version: "1.0.0" },
    });

    const state = await fetchDocument(created.id);
    expect(state).not.toBeNull();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state!);
    expect(doc.getMap<string>(META_KEY).get("entry")).toBe("/report.typ");
  });

  test("seeds the collab_document with the template's text files", async () => {
    const owner = await userFactory.create();
    await mockTemplateTarball([
      { name: "template/main.typ", data: "= Hello from template" },
      { name: "template/refs.bib", data: "@book{x, title={y}}" },
    ]);

    const created = await projectService.create(owner.id, {
      name: "Templated",
      template: { id: "foo", version: "1.0.0" },
    });

    const state = await fetchDocument(created.id);
    expect(state).not.toBeNull();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state!);
    const files = doc.getMap<Y.Text>(FILES_KEY);
    expect([...files.keys()].toSorted()).toEqual(["/main.typ", "/refs.bib"]);
    expect(files.get("/main.typ")?.toJSON()).toBe("= Hello from template");
  });

  test("seeds binary template entries as project blobs and wires them into the assets Y.Map", async () => {
    const owner = await userFactory.create();
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    await mockTemplateTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/logo.svg", data: svgBytes },
    ]);

    const created = await projectService.create(owner.id, {
      name: "Templated",
      template: { id: "foo", version: "1.0.0" },
    });

    const state = await fetchDocument(created.id);
    expect(state).not.toBeNull();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state!);
    const files = doc.getMap<Y.Text>(FILES_KEY);
    const assets = doc.getMap<string>(ASSETS_KEY);
    expect([...files.keys()]).toEqual(["/main.typ"]);
    expect([...assets.keys()]).toEqual(["/logo.svg"]);

    const blobs = await currentDb()
      .select()
      .from(projectBlob)
      .where(eq(projectBlob.projectId, created.id));
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.blobId).toBe(assets.get("/logo.svg")!);
    expect(blobs[0]!.mime).toBe("image/svg+xml");
    expect(new Uint8Array(blobs[0]!.bytes)).toEqual(svgBytes);
  });

  test("fails the create when the template tarball can't be fetched, leaving no project row", async () => {
    const owner = await userFactory.create();
    mockTemplateFetchFailure();

    await expectThrows(
      () =>
        projectService.create(owner.id, {
          name: "Should not exist",
          template: { id: "missing", version: "1.0.0" },
        }),
      Error
    );

    const projects = await currentDb().select().from(projectTable);
    expect(projects).toHaveLength(0);
  });
});

describe("ProjectService.update", () => {
  test("renames the project", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({
      ownerUserId: owner.id,
      name: "Original",
    });

    const result = await projectService.update(project.id, { name: "Renamed" });

    expect(result.id).toBe(project.id);
    expect(result.name).toBe("Renamed");
  });

  test("throws NotFoundError when the project does not exist", async () => {
    await expectThrows(
      () => projectService.update(crypto.randomUUID(), { name: "X" }),
      NotFoundError
    );
  });

  test("throws NotFoundError when the project is soft-deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);

    await expectThrows(() => projectService.update(project.id, { name: "X" }), NotFoundError);
  });
});

describe("ProjectService.remove", () => {
  test("soft-deletes the project by setting deletedAt", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const result = await projectService.remove(project.id);

    expect(result.id).toBe(project.id);
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  test("throws NotFoundError when the project does not exist", async () => {
    await expectThrows(() => projectService.remove(crypto.randomUUID()), NotFoundError);
  });

  test("throws NotFoundError when the project is already soft-deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);

    await expectThrows(() => projectService.remove(project.id), NotFoundError);
  });
});
