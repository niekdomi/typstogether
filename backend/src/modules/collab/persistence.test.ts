import { afterEach, describe, expect, test } from "bun:test";

import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { fetchDocument, storeDocument } from "./persistence";

afterEach(cleanDb);

describe("fetchDocument", () => {
  test("returns null when no document exists for the project", async () => {
    const owner = await userFactory.create();
    const proj = await projectFactory.create({ ownerUserId: owner.id });

    expect(await fetchDocument(proj.id)).toBeNull();
  });

  test("returns the state that was stored", async () => {
    const owner = await userFactory.create();
    const proj = await projectFactory.create({ ownerUserId: owner.id });
    const state = new Uint8Array([1, 2, 3]);

    await storeDocument(proj.id, state);

    expect(await fetchDocument(proj.id)).toEqual(state);
  });
});

describe("storeDocument", () => {
  test("upserts: second call replaces state", async () => {
    const owner = await userFactory.create();
    const proj = await projectFactory.create({ ownerUserId: owner.id });

    await storeDocument(proj.id, new Uint8Array([1, 2, 3]));
    await storeDocument(proj.id, new Uint8Array([4, 5, 6]));

    expect(await fetchDocument(proj.id)).toEqual(new Uint8Array([4, 5, 6]));
  });
});
