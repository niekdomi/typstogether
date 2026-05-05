import { afterEach, describe, expect, test } from "bun:test";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { NotFoundError } from "../../errors";
import { memberService } from "../members/service";
import { projectService } from "./service";

afterEach(cleanDb);

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

    await expectThrows(
      () => projectService.getMembership(stranger.id, project.id),
      NotFoundError
    );
  });

  test("throws NotFoundError when the project is soft-deleted", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await projectService.remove(project.id);

    await expectThrows(() => projectService.getMembership(owner.id, project.id), NotFoundError);
  });
});

describe("ProjectService.create", () => {
  test("creates a project owned by the given user", async () => {
    const owner = await userFactory.create();

    const result = await projectService.create(owner.id, { name: "My Project" });

    expect(result.name).toBe("My Project");
    expect(result.ownerUserId).toBe(owner.id);
    expect(result.deletedAt).toBeNull();
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
