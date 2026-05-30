import { afterEach, describe, expect, test } from "bun:test";

import { projectRoutes } from ".";
import { buildTestApp, jsonInit, requestOn, setTestUser } from "../../../test/app";
import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { memberService } from "../members/service";
import { projectService } from "./service";

const request = requestOn(buildTestApp(projectRoutes));

afterEach(async () => {
  setTestUser(null);
  await cleanDb();
});

describe("GET /projects", () => {
  test("401 when unauthenticated", async () => {
    const res = await request("/projects");

    expect(res.status).toBe(401);
  });

  test("200 returns owned and member projects", async () => {
    const owner = await userFactory.create();
    const other = await userFactory.create();
    const owned = await projectFactory.create({ ownerUserId: owner.id });
    const joined = await projectFactory.create({ ownerUserId: other.id });
    await memberService.create(joined.id, owner.id, "viewer");
    await projectFactory.create({ ownerUserId: other.id });
    setTestUser(owner);

    const res = await request("/projects");
    const body = (await res.json()) as { project: { id: string }; role: string }[];

    expect(res.status).toBe(200);
    expect(body.map((r) => r.project.id).toSorted()).toEqual([joined.id, owned.id].toSorted());
    const ownedRow = body.find((r) => r.project.id === owned.id);
    const joinedRow = body.find((r) => r.project.id === joined.id);
    expect(ownedRow!.role).toBe("owner");
    expect(joinedRow!.role).toBe("viewer");
  });

  test("200 empty when the user has no projects", async () => {
    const user = await userFactory.create();
    setTestUser(user);

    const res = await request("/projects");
    const body = (await res.json()) as unknown[];

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe("POST /projects", () => {
  test("401 when unauthenticated", async () => {
    const res = await request("/projects", jsonInit("POST", { name: "New" }));

    expect(res.status).toBe(401);
  });

  test("200 creates a project owned by the caller", async () => {
    const user = await userFactory.create();
    setTestUser(user);

    const res = await request("/projects", jsonInit("POST", { name: "New" }));
    const body = (await res.json()) as { id: string; name: string; ownerUserId: string };

    expect(res.status).toBe(200);
    expect(body.name).toBe("New");
    expect(body.ownerUserId).toBe(user.id);
  });

  test("422 on empty name", async () => {
    const user = await userFactory.create();
    setTestUser(user);

    const res = await request("/projects", jsonInit("POST", { name: "" }));

    expect(res.status).toBe(422);
  });

  test("422 on missing body", async () => {
    const user = await userFactory.create();
    setTestUser(user);

    const res = await request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(422);
  });

  test("429 when a second create lands within the cooldown", async () => {
    const user = await userFactory.create();
    setTestUser(user);

    const first = await request("/projects", jsonInit("POST", { name: "One" }));
    const second = await request("/projects", jsonInit("POST", { name: "Two" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});

describe("GET /projects/:id", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}`);

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}`);

    expect(res.status).toBe(404);
  });

  test("404 when the project is soft-deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);
    setTestUser(owner);

    const res = await request(`/projects/${project.id}`);

    expect(res.status).toBe(404);
  });

  test("200 owner sees role=owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}`);
    const body = (await res.json()) as { project: { id: string }; role: string };

    expect(res.status).toBe(200);
    expect(body.project.id).toBe(project.id);
    expect(body.role).toBe("owner");
  });

  test("200 viewer sees role=viewer", async () => {
    const owner = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, viewer.id, "viewer");
    setTestUser(viewer);

    const res = await request(`/projects/${project.id}`);
    const body = (await res.json()) as { role: string };

    expect(res.status).toBe(200);
    expect(body.role).toBe("viewer");
  });
});

describe("GET /projects/:id/snapshot", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}/snapshot`);

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/snapshot`);

    expect(res.status).toBe(404);
  });

  test("200 returns an empty snapshot for a member's blank project", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/snapshot`);
    const body = (await res.json()) as {
      entry: string;
      files: Record<string, string>;
      assets: Record<string, string>;
    };

    expect(res.status).toBe(200);
    expect(body).toEqual({ entry: "/main.typ", files: {}, assets: {} });
  });
});

describe("PATCH /projects/:id", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}`, jsonInit("PATCH", { name: "Renamed" }));

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}`, jsonInit("PATCH", { name: "Renamed" }));

    expect(res.status).toBe(404);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}`, jsonInit("PATCH", { name: "Renamed" }));

    expect(res.status).toBe(403);
  });

  test("200 owner renames the project", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id, name: "Original" });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}`, jsonInit("PATCH", { name: "Renamed" }));
    const body = (await res.json()) as { id: string; name: string };

    expect(res.status).toBe(200);
    expect(body.id).toBe(project.id);
    expect(body.name).toBe("Renamed");
  });

  test("422 on empty name", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}`, jsonInit("PATCH", { name: "" }));

    expect(res.status).toBe(422);
  });
});

describe("DELETE /projects/:id", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}`, { method: "DELETE" });

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}`, { method: "DELETE" });

    expect(res.status).toBe(403);
  });

  test("200 owner soft-deletes the project", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}`, { method: "DELETE" });
    const body = (await res.json()) as { id: string; deletedAt: string | null };

    expect(res.status).toBe(200);
    expect(body.id).toBe(project.id);
    expect(body.deletedAt).not.toBeNull();
    expect(await projectService.list(owner.id)).toEqual([]);
  });
});
