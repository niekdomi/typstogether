import { afterEach, describe, expect, test } from "bun:test";

import { blobRoutes } from ".";
import { buildTestApp, requestOn, setTestUser } from "../../../test/app";
import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { memberService } from "../members/service";
import { blobService } from "./service";

const request = requestOn(buildTestApp(blobRoutes));

// Smallest valid PNG: 1x1 transparent pixel.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const uploadInit = (bytes: Uint8Array, mime = "image/png", name = "blob.png"): RequestInit => {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type: mime }));
  return { method: "POST", body: form };
};

interface UploadBody {
  id: string;
  mime: string;
  size: number;
}

afterEach(async () => {
  setTestUser(null);
  await cleanDb();
});

describe("POST /projects/:id/blobs", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));

    expect(res.status).toBe(401);
  });

  test("403 when caller is a viewer", async () => {
    const owner = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, viewer.id, "viewer");
    setTestUser(viewer);

    const res = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));

    expect(res.status).toBe(403);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));

    expect(res.status).toBe(404);
  });

  test("422 for unsupported mime types", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/blobs`,
      uploadInit(new Uint8Array([1, 2, 3]), "application/zip", "x.zip")
    );

    expect(res.status).toBe(422);
  });

  test("200 returns id, mime, size for the owner", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));
    const body = (await res.json()) as UploadBody;

    expect(res.status).toBe(200);
    expect(body.id).toMatch(UUID_RE);
    expect(body.mime).toBe("image/png");
    expect(body.size).toBe(PNG_BYTES.byteLength);
  });

  test("200 also for an editor", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));

    expect(res.status).toBe(200);
  });

  test("two uploads of the same content return different ids (no dedup)", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res1 = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));
    const r1 = (await res1.json()) as UploadBody;
    const res2 = await request(`/projects/${project.id}/blobs`, uploadInit(PNG_BYTES));
    const r2 = (await res2.json()) as UploadBody;

    expect(r1.id).not.toBe(r2.id);
  });
});

describe("GET /projects/:id/blobs/:blobId", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const meta = await blobService.store(
      project.id,
      new File([PNG_BYTES], "x.png", { type: "image/png" })
    );

    const res = await request(`/projects/${project.id}/blobs/${meta.id}`);

    expect(res.status).toBe(401);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    const meta = await blobService.store(
      project.id,
      new File([PNG_BYTES], "x.png", { type: "image/png" })
    );
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/blobs/${meta.id}`);

    expect(res.status).toBe(404);
  });

  test("404 when the blob does not exist in this project", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/blobs/${crypto.randomUUID()}`);

    expect(res.status).toBe(404);
  });

  test("422 for malformed UUID in path", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/blobs/not-a-uuid`);

    expect(res.status).toBe(422);
  });

  test("200 viewers can read; bytes, content-type, cache-control are set", async () => {
    const owner = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, viewer.id, "viewer");
    const meta = await blobService.store(
      project.id,
      new File([PNG_BYTES], "x.png", { type: "image/png" })
    );
    setTestUser(viewer);

    const res = await request(`/projects/${project.id}/blobs/${meta.id}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(PNG_BYTES);
  });

  test("does not leak blobs from another project even when the id is known", async () => {
    const ownerA = await userFactory.create();
    const projectA = await projectFactory.create({ ownerUserId: ownerA.id });
    const meta = await blobService.store(
      projectA.id,
      new File([PNG_BYTES], "x.png", { type: "image/png" })
    );

    const ownerB = await userFactory.create();
    const projectB = await projectFactory.create({ ownerUserId: ownerB.id });
    setTestUser(ownerB);

    const res = await request(`/projects/${projectB.id}/blobs/${meta.id}`);

    expect(res.status).toBe(404);
  });
});
