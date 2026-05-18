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

    const { text, binary } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...text.keys()].toSorted()).toEqual(["/main.typ", "/refs.bib"]);
    expect(text.get("/main.typ")).toBe("= Hello");
    expect(binary.size).toBe(0);
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

    const { text } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...text.keys()]).toEqual(["/main.typ"]);
    expect(text.get("/main.typ")).toBe("= Custom path");
  });

  test("surfaces images, fonts, and archives as binary entries with mapped MIME types", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ttfBytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00]);
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/cover.png", data: pngBytes },
      { name: "template/fonts/Body.ttf", data: ttfBytes },
      { name: "template/extras.zip", data: zipBytes },
    ]);

    const { text, binary } = await fetchTemplateFiles("foo", "1.0.0");

    expect([...text.keys()]).toEqual(["/main.typ"]);
    expect([...binary.keys()].toSorted()).toEqual(["/cover.png", "/extras.zip", "/fonts/Body.ttf"]);
    expect(binary.get("/cover.png")?.mime).toBe("image/png");
    expect(binary.get("/cover.png")?.bytes).toEqual(pngBytes);
    expect(binary.get("/fonts/Body.ttf")?.mime).toBe("font/ttf");
    expect(binary.get("/extras.zip")?.mime).toBe("application/zip");
  });

  test("falls back to application/octet-stream for unknown extensions", async () => {
    const blob = new Uint8Array([1, 2, 3, 4]);
    await mockFetchTarball([
      { name: "template/main.typ", data: "= Hi" },
      { name: "template/data.bin", data: blob },
    ]);

    const { binary } = await fetchTemplateFiles("foo", "1.0.0");

    expect(binary.get("/data.bin")?.mime).toBe("application/octet-stream");
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
