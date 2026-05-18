import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createTarGzip, type TarFileInput } from "nanotar";

import { fetchTemplateFiles } from "./files";

async function mockFetchTarball(entries: TarFileInput[]) {
  const body = await createTarGzip(entries);
  globalThis.fetch = mock(() => Promise.resolve(new Response(body))) as unknown as typeof fetch;
}

let originalFetch: typeof globalThis.fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchTemplateFiles", () => {
  test("returns text files under the default `template/` directory", async () => {
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hello" },
      { name: "template/refs.bib", data: "@book{x, title={y}}" },
      { name: "lib.typ", data: "// package code, not template" },
    ]);

    const { files } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...files.keys()].toSorted()).toEqual(["/main.typ", "/refs.bib"]);
    expect(files.get("/main.typ")).toBe("= Hello");
  });

  test("honours a custom template path declared in typst.toml", async () => {
    await mockFetchTarball([
      {
        name: "typst.toml",
        data: '[package]\nname = "foo"\n\n[template]\npath = "starter"\nentrypoint = "main.typ"\n',
      },
      { name: "starter/main.typ", data: "= Custom path" },
      { name: "template/main.typ", data: "// ignored, wrong dir" },
    ]);

    const { files } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...files.keys()]).toEqual(["/main.typ"]);
    expect(files.get("/main.typ")).toBe("= Custom path");
  });

  test("skips binary files by extension allowlist", async () => {
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/cover.png", data: "PNG-bytes-here" },
    ]);

    const { files } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...files.keys()]).toEqual(["/main.typ"]);
  });

  test("throws BadGateway when the registry responds non-2xx", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("nope", { status: 404 }))
    ) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await fetchTemplateFiles("does-not-exist", "1.0.0");
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ status: 502 });
  });
});
