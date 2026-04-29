import { describe, expect, test } from "bun:test";

import { createProject, createUser } from "../../../test/factories";
import { expectThrows, withRollback } from "../../../test/helpers";
import { ConflictError, NotFoundError } from "../../errors";
import * as members from "./service";

describe("members.list", () => {
  test("returns empty for project with no members", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const project = await createProject(tx, owner.id);

      const result = await members.list(project.id, tx);

      expect(result).toEqual([]);
    });
  });

  test("returns members joined to user info", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const member = await createUser(tx);
      const project = await createProject(tx, owner.id);
      await members.create(project.id, member.id, "editor", tx);

      const result = await members.list(project.id, tx);

      expect(result).toHaveLength(1);
      expect(result[0]!.member.userId).toBe(member.id);
      expect(result[0]!.member.role).toBe("editor");
      expect(result[0]!.user.id).toBe(member.id);
      expect(result[0]!.user.email).toBe(member.email);
    });
  });
});

describe("members.create", () => {
  test("inserts a new member with the given role", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const member = await createUser(tx);
      const project = await createProject(tx, owner.id);

      const result = await members.create(project.id, member.id, "editor", tx);

      expect(result.userId).toBe(member.id);
      expect(result.projectId).toBe(project.id);
      expect(result.role).toBe("editor");
    });
  });

  test("throws ConflictError when the user is already a member", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const member = await createUser(tx);
      const project = await createProject(tx, owner.id);
      await members.create(project.id, member.id, "editor", tx);

      await expectThrows(() => members.create(project.id, member.id, "viewer", tx), ConflictError);
    });
  });
});

describe("members.remove", () => {
  test("removes an existing member", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const member = await createUser(tx);
      const project = await createProject(tx, owner.id);
      await members.create(project.id, member.id, "editor", tx);

      const removed = await members.remove(project.id, member.id, tx);

      expect(removed.userId).toBe(member.id);
      expect(await members.list(project.id, tx)).toEqual([]);
    });
  });

  test("throws NotFoundError when the user is not a member", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const stranger = await createUser(tx);
      const project = await createProject(tx, owner.id);

      await expectThrows(() => members.remove(project.id, stranger.id, tx), NotFoundError);
    });
  });
});

describe("members.changeRole", () => {
  test("updates the role of an existing member", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const member = await createUser(tx);
      const project = await createProject(tx, owner.id);
      await members.create(project.id, member.id, "viewer", tx);

      const updated = await members.changeRole(project.id, member.id, "editor", tx);

      expect(updated.role).toBe("editor");
    });
  });

  test("throws NotFoundError when the user is not a member", async () => {
    await withRollback(async (tx) => {
      const owner = await createUser(tx);
      const stranger = await createUser(tx);
      const project = await createProject(tx, owner.id);

      await expectThrows(
        () => members.changeRole(project.id, stranger.id, "editor", tx),
        NotFoundError
      );
    });
  });
});
