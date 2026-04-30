import { afterEach, describe, expect, test } from "bun:test";

import { createProject, createUser } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { ConflictError, NotFoundError } from "../../errors";
import { memberService } from "./service";

afterEach(cleanDb);

describe("MemberService.list", () => {
  test("returns empty for project with no members", async () => {
    const owner = await createUser();
    const project = await createProject(owner.id);

    const result = await memberService.list(project.id);

    expect(result).toEqual([]);
  });

  test("returns members joined to user info", async () => {
    const owner = await createUser();
    const member = await createUser();
    const project = await createProject(owner.id);
    await memberService.create(project.id, member.id, "editor");

    const result = await memberService.list(project.id);

    expect(result).toHaveLength(1);
    expect(result[0]!.member.userId).toBe(member.id);
    expect(result[0]!.member.role).toBe("editor");
    expect(result[0]!.user.id).toBe(member.id);
    expect(result[0]!.user.email).toBe(member.email);
  });
});

describe("MemberService.create", () => {
  test("inserts a new member with the given role", async () => {
    const owner = await createUser();
    const member = await createUser();
    const project = await createProject(owner.id);

    const result = await memberService.create(project.id, member.id, "editor");

    expect(result.userId).toBe(member.id);
    expect(result.projectId).toBe(project.id);
    expect(result.role).toBe("editor");
  });

  test("throws ConflictError when the user is already a member", async () => {
    const owner = await createUser();
    const member = await createUser();
    const project = await createProject(owner.id);
    await memberService.create(project.id, member.id, "editor");

    await expectThrows(() => memberService.create(project.id, member.id, "viewer"), ConflictError);
  });
});

describe("MemberService.remove", () => {
  test("removes an existing member", async () => {
    const owner = await createUser();
    const member = await createUser();
    const project = await createProject(owner.id);
    await memberService.create(project.id, member.id, "editor");

    const removed = await memberService.remove(project.id, member.id);

    expect(removed.userId).toBe(member.id);
    expect(await memberService.list(project.id)).toEqual([]);
  });

  test("throws NotFoundError when the user is not a member", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);

    await expectThrows(() => memberService.remove(project.id, stranger.id), NotFoundError);
  });
});

describe("MemberService.changeRole", () => {
  test("updates the role of an existing member", async () => {
    const owner = await createUser();
    const member = await createUser();
    const project = await createProject(owner.id);
    await memberService.create(project.id, member.id, "viewer");

    const updated = await memberService.changeRole(project.id, member.id, "editor");

    expect(updated.role).toBe("editor");
  });

  test("throws NotFoundError when the user is not a member", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const project = await createProject(owner.id);

    await expectThrows(
      () => memberService.changeRole(project.id, stranger.id, "editor"),
      NotFoundError
    );
  });
});
