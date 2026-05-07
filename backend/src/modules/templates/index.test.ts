import { afterEach, describe, expect, mock, test } from "bun:test";

import { templateRoutes } from ".";
import { buildTestApp, requestOn } from "../../../test/app";

const request = requestOn(buildTestApp(templateRoutes));

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /templates", () => {
  test("200 returns a JSON array", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        Response.json([
          { name: "tpl", version: "1.0.0", template: { path: "template", entrypoint: "main.typ" } },
        ])
      )
    ) as unknown as typeof fetch;

    const res = await request("/templates");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
