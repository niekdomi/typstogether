import { afterEach, describe, expect, test } from "bun:test";

import { fontRoutes } from ".";
import { buildTestApp, requestOn, setTestUser } from "../../../test/app";
import { projectFactory, userFactory } from "../../../test/factories";
import { cleanDb } from "../../../test/helpers";
import { blobService } from "../blobs/service";
import { memberService } from "../members/service";

const request = requestOn(buildTestApp(fontRoutes));

// Only the first 4 bytes (the sfnt magic) matter to `sniffFontMime`; the tail is
// opaque padding. Kept >16 bytes because Bun's in-process multipart parser drops
// very short uploads — real fonts are far larger, so this is test-transport only.
const padFont = (magic: number[]): Uint8Array =>
  new Uint8Array([...magic, ...Array.from({ length: 24 }, () => 0)]);
const TTF_BYTES = padFont([0x00, 0x01, 0x00, 0x00]);
const OTF_BYTES = padFont([0x4f, 0x54, 0x54, 0x4f]); // "OTTO"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Browsers send unreliable MIME for fonts, so the route ignores it and sniffs
// magic bytes; the File type here is deliberately wrong to prove that.
const uploadInit = (bytes: Uint8Array, name = "MyFont.ttf"): RequestInit => {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type: "application/octet-stream" }));
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

describe("POST /projects/:id/fonts", () => {
  test("401 when unauthenticated", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });

    const res = await request(`/projects/${project.id}/fonts`, uploadInit(TTF_BYTES));

    expect(res.status).toBe(401);
  });

  test("403 when caller is a viewer", async () => {
    const owner = await userFactory.create();
    const viewer = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, viewer.id, "viewer");
    setTestUser(viewer);

    const res = await request(`/projects/${project.id}/fonts`, uploadInit(TTF_BYTES));

    expect(res.status).toBe(403);
  });

  test("404 when caller is not a member", async () => {
    const owner = await userFactory.create();
    const stranger = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(stranger);

    const res = await request(`/projects/${project.id}/fonts`, uploadInit(TTF_BYTES));

    expect(res.status).toBe(404);
  });

  test("415 when the bytes are not a TTF/OTF/TTC font", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(
      `/projects/${project.id}/fonts`,
      uploadInit(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "not.ttf") // PNG magic
    );

    expect(res.status).toBe(415);
  });

  test("200 stores a TTF for the owner: normalized mime + retrievable bytes", async () => {
    const owner = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    setTestUser(owner);

    const res = await request(`/projects/${project.id}/fonts`, uploadInit(TTF_BYTES));
    const body = (await res.json()) as UploadBody;

    expect(res.status).toBe(200);
    expect(body.id).toMatch(UUID_RE);
    expect(body.mime).toBe("font/ttf");
    expect(body.size).toBe(TTF_BYTES.byteLength);

    // The blob row exists and round-trips (fetched via the shared blob store).
    const stored = await blobService.fetch(project.id, body.id);
    expect(stored.bytes).toEqual(TTF_BYTES);
  });

  test("200 detects OTF, and an editor may upload", async () => {
    const owner = await userFactory.create();
    const editor = await userFactory.create();
    const project = await projectFactory.create({ ownerUserId: owner.id });
    await memberService.create(project.id, editor.id, "editor");
    setTestUser(editor);

    const res = await request(`/projects/${project.id}/fonts`, uploadInit(OTF_BYTES, "x.otf"));
    const body = (await res.json()) as UploadBody;

    expect(res.status).toBe(200);
    expect(body.mime).toBe("font/otf");
  });
});
