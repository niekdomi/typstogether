import { afterEach, describe, expect, test } from "bun:test";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { ConflictError, GoneError, NotFoundError } from "../../errors";
import { memberService } from "../members/service";
import { projectService } from "../projects/service";
import { inviteService } from "./service";

afterEach(cleanDb);

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

describe("InviteService.list", () => {
  test("returns empty for a project with no invites", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const result = await inviteService.list(project.id);

    expect(result).toEqual([]);
  });

  test("returns only invites for the requested project", async () => {
    const owner = await userFactory.create();
    const projectA = await projectFactory.create({ ownerUserId: owner.id });
    const projectB = await projectFactory.create({ ownerUserId: owner.id });
    await inviteService.create({
      projectId: projectA.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    await inviteService.create({
      projectId: projectB.id,
      createdByUserId: owner.id,
      role: "viewer",
      expiresAt: futureDate(),
    });

    const result = await inviteService.list(projectA.id);

    expect(result).toHaveLength(1);
    expect(result[0]!.projectId).toBe(projectA.id);
  });
});

describe("InviteService.create", () => {
  test("returns a plaintext token distinct from the stored hash", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const { invite, token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    expect(token).toBeTruthy();
    expect(invite.tokenHash).not.toBe(token);
    expect(invite.role).toBe("editor");
    expect(invite.revokedAt).toBeNull();
  });

  test("produces a different token on each call", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const a = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    const b = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    expect(a.token).not.toBe(b.token);
    expect(a.invite.tokenHash).not.toBe(b.invite.tokenHash);
  });
});

describe("InviteService.revoke", () => {
  test("sets revokedAt on the invite", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { invite } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    const revoked = await inviteService.revoke(project.id, invite.id);

    expect(revoked.id).toBe(invite.id);
    expect(revoked.revokedAt).toBeInstanceOf(Date);
  });

  test("throws NotFoundError when the invite does not exist", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    await expectThrows(
      () => inviteService.revoke(project.id, crypto.randomUUID()),
      NotFoundError
    );
  });

  test("throws NotFoundError when the invite is already revoked", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { invite } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    await inviteService.revoke(project.id, invite.id);

    await expectThrows(() => inviteService.revoke(project.id, invite.id), NotFoundError);
  });

  test("throws NotFoundError when the invite belongs to a different project", async () => {
    const owner = await userFactory.create();
    const projectA = await projectFactory.create({ ownerUserId: owner.id });
    const projectB = await projectFactory.create({ ownerUserId: owner.id });
    const { invite } = await inviteService.create({
      projectId: projectA.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    await expectThrows(() => inviteService.revoke(projectB.id, invite.id), NotFoundError);
  });
});

describe("InviteService.redeem", () => {
  test("adds the user as a member with the invite's role", async () => {
    const owner = await userFactory.create();
    const newcomer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "viewer",
      expiresAt: futureDate(),
    });

    const result = await inviteService.redeem(newcomer.id, token);

    expect(result.project.id).toBe(project.id);
    expect(result.role).toBe("viewer");

    const members = await memberService.list(project.id);
    expect(members).toHaveLength(1);
    expect(members[0]!.member.userId).toBe(newcomer.id);
    expect(members[0]!.member.role).toBe("viewer");
  });

  test("throws NotFoundError on an unknown token", async () => {
    const newcomer = await userFactory.create();

    await expectThrows(() => inviteService.redeem(newcomer.id, "not-a-real-token"), NotFoundError);
  });

  test("throws GoneError when the invite is revoked", async () => {
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

    await expectThrows(() => inviteService.redeem(newcomer.id, token), GoneError);
  });

  test("throws GoneError when the invite has expired", async () => {
    const owner = await userFactory.create();
    const newcomer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expectThrows(() => inviteService.redeem(newcomer.id, token), GoneError);
  });

  test("throws ConflictError when the redeemer is the project owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    await expectThrows(() => inviteService.redeem(owner.id, token), ConflictError);
  });

  test("throws NotFoundError when the project has been soft-deleted", async () => {
    const owner = await userFactory.create();
    const newcomer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });
    await projectService.remove(project.id);

    await expectThrows(() => inviteService.redeem(newcomer.id, token), NotFoundError);
  });

  test("throws ConflictError when the user is already a member", async () => {
    const owner = await userFactory.create();
    const member = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, member.id, "viewer");
    const { token } = await inviteService.create({
      projectId: project.id,
      createdByUserId: owner.id,
      role: "editor",
      expiresAt: futureDate(),
    });

    await expectThrows(() => inviteService.redeem(member.id, token), ConflictError);
  });
});
