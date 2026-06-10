import { describe, expect, test } from "bun:test";

import { hasTextExtension, normalizeFile, normalizeFolder } from "./paths";

describe("normalizeFile", () => {
  test("appends .typ when missing", () => {
    expect(normalizeFile("foo", "")).toBe("/foo.typ");
  });

  test("keeps .typ when already present", () => {
    expect(normalizeFile("foo.typ", "")).toBe("/foo.typ");
  });

  test("preserves recognized text extensions", () => {
    expect(normalizeFile("refs.bib", "")).toBe("/refs.bib");
    expect(normalizeFile("data.toml", "/a")).toBe("/a/data.toml");
    expect(normalizeFile("notes.txt", "")).toBe("/notes.txt");
  });

  test("appends .typ for an unrecognized extension", () => {
    expect(normalizeFile("foo.bar", "")).toBe("/foo.bar.typ");
  });

  test("places file under dir", () => {
    expect(normalizeFile("bar", "/a")).toBe("/a/bar.typ");
  });

  test("allows nested input creating implicit subfolder", () => {
    expect(normalizeFile("sub/file", "/a")).toBe("/a/sub/file.typ");
  });

  test("absolute input ignores dir", () => {
    expect(normalizeFile("/top.typ", "/a")).toBe("/top.typ");
  });

  describe(".. traversal", () => {
    test("single .. jumps to parent dir", () => {
      expect(normalizeFile("../other", "/a/b")).toBe("/a/other.typ");
    });

    test("multiple .. traverse multiple levels", () => {
      expect(normalizeFile("../../main", "/a/b")).toBe("/main.typ");
    });

    test(".. from root-level dir is clamped to root", () => {
      expect(normalizeFile("../escape", "/a")).toBe("/escape.typ");
    });

    test("excessive .. are clamped and never go above root", () => {
      expect(normalizeFile("../escape", "")).toBe("/escape.typ");
    });

    test(".. in the middle of a path is resolved", () => {
      expect(normalizeFile("sub/../other", "/a")).toBe("/a/other.typ");
    });
  });
});

describe("normalizeFolder", () => {
  test("places folder under dir", () => {
    expect(normalizeFolder("docs", "")).toBe("/docs");
  });

  test("strips trailing slashes", () => {
    expect(normalizeFolder("docs/", "")).toBe("/docs");
    expect(normalizeFolder("docs///", "")).toBe("/docs");
  });

  test("places folder under nested dir", () => {
    expect(normalizeFolder("sub", "/a")).toBe("/a/sub");
  });

  test("absolute input ignores dir", () => {
    expect(normalizeFolder("/top", "/a")).toBe("/top");
  });

  describe(".. traversal", () => {
    test("single .. jumps to parent dir", () => {
      expect(normalizeFolder("..", "/a/b")).toBe("/a");
    });

    test("../sibling reaches sibling folder", () => {
      expect(normalizeFolder("../sibling", "/a/b")).toBe("/a/sibling");
    });

    test(".. from root-level dir resolves to root → returns empty (invalid)", () => {
      expect(normalizeFolder("..", "/a")).toBe("");
    });

    test(".. from empty dir (= root context) returns empty", () => {
      expect(normalizeFolder("..", "")).toBe("");
    });

    test("excessive .. are clamped and never go above root", () => {
      expect(normalizeFolder("../../x", "/a/b")).toBe("/x");
      expect(normalizeFolder("../x", "")).toBe("/x");
    });

    test(".. in the middle of a path is resolved", () => {
      expect(normalizeFolder("sub/../other", "/a")).toBe("/a/other");
    });
  });
});

describe("hasTextExtension", () => {
  test("true for allowlisted text extensions", () => {
    for (const name of ["main.typ", "refs.bib", "style.csl", "data.toml", "table.csv", "x.yaml"]) {
      expect(hasTextExtension(name)).toBe(true);
    }
  });

  test("is case-insensitive", () => {
    expect(hasTextExtension("DATA.TOML")).toBe(true);
  });

  test("false for binary assets and extensionless names", () => {
    for (const name of ["photo.png", "icon.svg", "blob.cbor", "Makefile"]) {
      expect(hasTextExtension(name)).toBe(false);
    }
  });
});
