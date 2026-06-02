import { afterEach, describe, expect, test } from "bun:test";

import { memberRoutes } from ".";
import { buildTestApp, jsonInit, requestOn, setTestUser } from "../../../test/app";
import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { memberService } from "./service";

const request = requestOn(buildTestApp(memberRoutes));

afterEach(async () => {
  setTestUser(null);
  await cleanDb();
});

describe("GET /projects/:id/members", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}/members`);

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/members`);

    expect(res.status).toBe(404);
  });

  test("200 returns joined members for the owner", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "editor");
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/members`);
    const body = (await res.json()) as { member: { userId: string }; user: { id: string } }[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]!.member.userId).toBe(member.id);
    expect(body[0]!.user.id).toBe(member.id);
  });

  test("200 for a viewer member", async () => {
    const owner = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, viewer.id, "viewer");
    setTestUser(viewer);

    const res = await request(`/projects/${project.id}/members`);

    expect(res.status).toBe(200);
  });

  test("response strips user shape to id/name/email/image", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "editor");
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/members`);
    const body = (await res.json()) as { user: Record<string, unknown> }[];

    expect(Object.keys(body[0]!.user).toSorted()).toEqual(["email", "id", "image", "name"]);
  });
});

describe("DELETE /projects/:id/members/:userId", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "editor");

    const res = await request(`/projects/${project.id}/members/${member.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member of the project", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/members/${owner.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}/members/${editor.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
  });

  test("200 owner removes a member and the row is gone", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "editor");
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/members/${member.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(await memberService.list(project.id)).toEqual([]);
  });

  test("404 owner removes a nonexistent member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/members/${stranger.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /projects/:id/members/me (leave)", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "editor");

    const res = await request(`/projects/${project.id}/members/me`, { method: "DELETE" });

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/members/me`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });

  test("403 when caller is the owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/members/me`, { method: "DELETE" });

    expect(res.status).toBe(403);
  });

  test("200 editor leaves and the row is gone", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}/members/me`, { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(await memberService.list(project.id)).toEqual([]);
  });

  test("200 viewer leaves and only that row is removed", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    await memberService.create(project.id, viewer.id, "viewer");
    setTestUser(viewer);

    const res = await request(`/projects/${project.id}/members/me`, { method: "DELETE" });
    const remaining = await memberService.list(project.id);

    expect(res.status).toBe(200);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.member.userId).toBe(editor.id);
  });
});

describe("PATCH /projects/:id/members/:userId", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "viewer");

    const res = await request(
      `/projects/${project.id}/members/${member.id}`,
      jsonInit("PATCH", { role: "editor" })
    );

    expect(res.status).toBe(401);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    await memberService.create(project.id, member.id, "viewer");
    setTestUser(editor);

    const res = await request(
      `/projects/${project.id}/members/${member.id}`,
      jsonInit("PATCH", { role: "editor" })
    );

    expect(res.status).toBe(403);
  });

  test("200 owner promotes viewer to editor and DB reflects it", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "viewer");
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/members/${member.id}`,
      jsonInit("PATCH", { role: "editor" })
    );
    const body = (await res.json()) as { role: string };

    expect(res.status).toBe(200);
    expect(body.role).toBe("editor");
    const [m] = await memberService.list(project.id);
    expect(m!.member.role).toBe("editor");
  });

  test("404 owner patches nonexistent member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/members/${stranger.id}`,
      jsonInit("PATCH", { role: "editor" })
    );

    expect(res.status).toBe(404);
  });

  test("422 on role outside the allowed enum", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "viewer");
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/members/${member.id}`,
      jsonInit("PATCH", { role: "owner" })
    );

    expect(res.status).toBe(422);
  });

  test("422 on missing body", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "viewer");
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(422);
  });
});
