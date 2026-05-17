import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { buildTarGz, type TarEntry } from "../../../test/template-tar";
import { fetchTemplateFiles } from "./files";

function mockFetchTarball(entries: TarEntry[]) {
  const body = buildTarGz(entries);
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
    mockFetchTarball([
      { name: "template/main.typ", content: "= Hello" },
      { name: "template/refs.bib", content: "@book{x, title={y}}" },
      { name: "lib.typ", content: "// package code, not template" },
    ]);

    const { files } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...files.keys()].toSorted()).toEqual(["/main.typ", "/refs.bib"]);
    expect(files.get("/main.typ")).toBe("= Hello");
  });

  test("honours a custom template path declared in typst.toml", async () => {
    mockFetchTarball([
      {
        name: "typst.toml",
        content:
          '[package]\nname = "foo"\n\n[template]\npath = "starter"\nentrypoint = "main.typ"\n',
      },
      { name: "starter/main.typ", content: "= Custom path" },
      { name: "template/main.typ", content: "// ignored, wrong dir" },
    ]);

    const { files } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...files.keys()]).toEqual(["/main.typ"]);
    expect(files.get("/main.typ")).toBe("= Custom path");
  });

  test("skips binary files by extension allowlist", async () => {
    mockFetchTarball([
      { name: "template/main.typ", content: "= Hi" },
      { name: "template/cover.png", content: "PNG-bytes-here" },
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
