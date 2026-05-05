import { afterEach, describe, expect, test } from "bun:test";

import { inviteRoutes } from ".";
import { buildTestApp, jsonInit, requestOn, setTestUser } from "../../../test/app";
import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { memberService } from "../members/service";
import { inviteService } from "./service";

const request = requestOn(buildTestApp(inviteRoutes));

afterEach(async () => {
  setTestUser(null);
  await cleanDb();
});

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

describe("GET /projects/:id/invites", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}/invites`);

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/invites`);

    expect(res.status).toBe(404);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}/invites`);

    expect(res.status).toBe(403);
  });

  test("200 owner gets invite list with no tokenHash leak", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/invites`);
    const body = (await res.json()) as Record<string, unknown>[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty("tokenHash");
  });
});

describe("POST /projects/:id/invites", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(
      `/projects/${project.id}/invites`,
      jsonInit("POST", { role: "editor", expiresAt: futureDate() })
    );

    expect(res.status).toBe(401);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(
      `/projects/${project.id}/invites`,
      jsonInit("POST", { role: "editor", expiresAt: futureDate() })
    );

    expect(res.status).toBe(403);
  });

  test("200 owner gets back invite + plaintext token", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/invites`,
      jsonInit("POST", { role: "viewer", expiresAt: futureDate() })
    );
    const body = (await res.json()) as {
      invite: Record<string, unknown> & { id: string; role: string };
      token: string;
    };

    expect(res.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.invite.role).toBe("viewer");
    expect(body.invite).not.toHaveProperty("tokenHash");
  });

  test("422 on role outside the allowed enum", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/invites`,
      jsonInit("POST", { role: "owner", expiresAt: futureDate() })
    );

    expect(res.status).toBe(422);
  });

  test("422 on missing body", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(422);
  });
});

describe("DELETE /projects/:id/invites/:inviteId", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { invite } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    const res = await request(`/projects/${project.id}/invites/${invite.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  test("403 when caller is editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    const { invite } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    setTestUser(editor);

    const res = await request(`/projects/${project.id}/invites/${invite.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
  });

  test("200 owner revokes the invite", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { invite } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/invites/${invite.id}`, {
      method: "DELETE",
    });
    const body = (await res.json()) as { id: string; revokedAt: string | null };

    expect(res.status).toBe(200);
    expect(body.id).toBe(invite.id);
    expect(body.revokedAt).not.toBeNull();
  });

  test("404 owner targets a nonexistent invite", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/invites/${crypto.randomUUID()}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /invites/:token/redeem", () => {
  test("401 when unauthenticated", async () => {
    const res = await request("/invites/some-token/redeem", { method: "POST" });

    expect(res.status).toBe(401);
  });

  test("200 redeems and adds the user as a member", async () => {
    const owner = await userFactory.create();
    const newcomer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "viewer",
      expiresAt: futureDate(),
    });
    setTestUser(newcomer);

    const res = await request(`/invites/${token}/redeem`, { method: "POST" });
    const body = (await res.json()) as { project: { id: string }; role: string };

    expect(res.status).toBe(200);
    expect(body.project.id).toBe(project.id);
    expect(body.role).toBe("viewer");
    const members = await memberService.list(project.id);
    expect(members[0]!.member.userId).toBe(newcomer.id);
  });

  test("404 on unknown token", async () => {
    const newcomer = await userFactory.create();
    setTestUser(newcomer);

    const res = await request("/invites/not-a-real-token/redeem", { method: "POST" });

    expect(res.status).toBe(404);
  });

  test("410 when the invite has expired", async () => {
    const owner = await userFactory.create();
    const newcomer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: new Date(Date.now() - 1000),
    });
    setTestUser(newcomer);

    const res = await request(`/invites/${token}/redeem`, { method: "POST" });

    expect(res.status).toBe(410);
  });

  test("410 when the invite is revoked", async () => {
    const owner = await userFactory.create();
    const newcomer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { invite, token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    await inviteService.revoke(project.id, invite.id);
    setTestUser(newcomer);

    const res = await request(`/invites/${token}/redeem`, { method: "POST" });

    expect(res.status).toBe(410);
  });

  test("409 when the redeemer is the project owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    setTestUser(owner);

    const res = await request(`/invites/${token}/redeem`, { method: "POST" });

    expect(res.status).toBe(409);
  });
});
