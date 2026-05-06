import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";

import { TemplateService } from "./service";

interface UniverseTemplate {
  name: string;
  version: string;
  description?: string;
  authors?: string[];
  categories?: string[];
  template: { path: string; entrypoint: string };
}

function tpl(name: string, version: string, extras: Partial<UniverseTemplate> = {}) {
  return { name, version, template: { path: "template", entrypoint: "main.typ" }, ...extras };
}

let originalFetch: typeof globalThis.fetch;
let service: TemplateService;

function mockFetchOk(payload: unknown) {
  globalThis.fetch = mock(() => Promise.resolve(Response.json(payload))) as unknown as typeof fetch;
}

function mockFetchFail() {
  globalThis.fetch = mock(() =>
    Promise.reject(new Error("network down"))
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  service = new TemplateService();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setSystemTime();
});

describe("TemplateService.list", () => {
  test("filters out entries without a template field", async () => {
    mockFetchOk([{ name: "lib-only", version: "1.0.0" }, tpl("a-template", "1.0.0")]);

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a-template");
  });

  test("dedupes by name keeping the highest version", async () => {
    mockFetchOk([tpl("tpl", "0.1.0"), tpl("tpl", "0.10.0"), tpl("tpl", "0.2.0")]);

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(result[0]!.version).toBe("0.10.0");
  });

  test("returns slimmed shape with defaults for missing fields", async () => {
    mockFetchOk([tpl("tpl", "1.0.0")]);

    const result = await service.list();

    expect(result[0]).toEqual({
      id: "tpl",
      version: "1.0.0",
      description: "",
      authors: [],
      categories: [],
      thumbnailUrl: null,
    });
  });

  test("preserves description, authors, and categories when present", async () => {
    mockFetchOk([
      tpl("tpl", "1.0.0", {
        description: "A neat template",
        authors: ["Ada"],
        categories: ["paper", "thesis"],
      }),
    ]);

    const result = await service.list();

    expect(result[0]).toMatchObject({
      description: "A neat template",
      authors: ["Ada"],
      categories: ["paper", "thesis"],
    });
  });

  test("returns cached result within TTL", async () => {
    const fetchSpy = mock(() => Promise.resolve(Response.json([tpl("tpl", "1.0.0")])));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await service.list();
    await service.list();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("falls back to stale cache when fetch fails after TTL expires", async () => {
    setSystemTime(new Date("2020-01-01T00:00:00Z"));
    mockFetchOk([tpl("tpl", "1.0.0")]);
    const first = await service.list();

    setSystemTime(new Date("2020-01-01T02:00:00Z"));
    mockFetchFail();

    const second = await service.list();

    expect(second).toEqual(first);
  });

  test("returns empty array when fetch fails and no cache exists", async () => {
    mockFetchFail();

    const result = await service.list();

    expect(result).toEqual([]);
  });

  test("returns empty array when fetch responds with non-2xx and no cache exists", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("oops", { status: 503 }))
    ) as unknown as typeof fetch;

    const result = await service.list();

    expect(result).toEqual([]);
  });
});
