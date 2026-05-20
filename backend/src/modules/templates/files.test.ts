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

    const { text, binary, entry } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...text.keys()].toSorted()).toEqual(["/main.typ", "/refs.bib"]);
    expect(text.get("/main.typ")).toBe("= Hello");
    expect(binary.size).toBe(0);
    // No typst.toml in the tarball, so the entrypoint is unknown, callers
    // apply the default (/main.typ).
    expect(entry).toBeNull();
  });

  test("honors a custom template path declared in typst.toml", async () => {
    await mockFetchTarball([
      {
        name: "typst.toml",
        data: '[package]\nname = "foo"\n\n[template]\npath = "starter"\nentrypoint = "main.typ"\n',
      },
      { name: "starter/main.typ", data: "= Custom path" },
      { name: "template/main.typ", data: "// ignored, wrong dir" },
    ]);

    const { text, entry } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...text.keys()]).toEqual(["/main.typ"]);
    expect(text.get("/main.typ")).toBe("= Custom path");
    expect(entry).toBe("/main.typ");
  });

  test("returns the declared entrypoint when it's not /main.typ", async () => {
    await mockFetchTarball([
      {
        name: "typst.toml",
        data: '[package]\nname = "foo"\n\n[template]\npath = "template"\nentrypoint = "report.typ"\n',
      },
      { name: "template/report.typ", data: "= Report" },
      { name: "template/lib.typ", data: "// helpers" },
    ]);

    const { entry } = await fetchTemplateFiles("foo", "1.0.0");

    expect(entry).toBe("/report.typ");
  });

  test("partitions non-text files into the binary map and preserves their bytes", async () => {
    const fontBytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00]);
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/fonts/Body.ttf", data: fontBytes },
      { name: "template/extras.zip", data: zipBytes },
    ]);

    const { text, binary } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...text.keys()]).toEqual(["/main.typ"]);
    expect([...binary.keys()].toSorted()).toEqual(["/extras.zip", "/fonts/Body.ttf"]);
    expect(binary.get("/fonts/Body.ttf")?.bytes).toEqual(fontBytes);
    expect(binary.get("/extras.zip")?.bytes).toEqual(zipBytes);
  });

  test("falls back to mime-types by extension when file-type can't sniff the bytes", async () => {
    // SVG is XML so has no magic number; file-type returns undefined and we
    // expect mime-types to fill in image/svg+xml from the `.svg` extension.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/logo.svg", data: svg },
    ]);

    const { binary } = await fetchTemplateFiles("foo", "1.0.0");

    expect(binary.get("/logo.svg")?.mime).toBe("image/svg+xml");
  });

  test("falls back to application/octet-stream when neither sniff nor extension yield a MIME", async () => {
    const blob = new Uint8Array([1, 2, 3, 4]);
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/data.unknownext", data: blob },
    ]);

    const { binary } = await fetchTemplateFiles("foo", "1.0.0");

    expect(binary.get("/data.unknownext")?.mime).toBe("application/octet-stream");
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
