import { afterEach, describe, expect, test } from "bun:test";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb, expectThrows } from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import { memberService } from "../members/service";
import { authorizeCollab } from "./authorization";

afterEach(cleanDb);

describe("authorizeCollab", () => {
  test("throws ForbiddenError when user has no membership", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    await expectThrows(() => authorizeCollab(stranger.id, project.id), ForbiddenError);
  });

  test("throws ForbiddenError for a non-existent project", async () => {
    const user = await userFactory.create();

    await expectThrows(() => authorizeCollab(user.id, crypto.randomUUID()), ForbiddenError);
  });

  test("returns readOnly true for viewer", async () => {
    const owner = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, viewer.id, "viewer");

    expect(await authorizeCollab(viewer.id, project.id)).toEqual({ readOnly: true });
  });

  test("returns readOnly false for editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");

    expect(await authorizeCollab(editor.id, project.id)).toEqual({ readOnly: false });
  });

  test("returns readOnly false for owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    expect(await authorizeCollab(owner.id, project.id)).toEqual({ readOnly: false });
  });
});
