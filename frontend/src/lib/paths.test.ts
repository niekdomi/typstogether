import { describe, expect, test } from "bun:test";

import { normalizeFile, normalizeFolder } from "./paths";

// Mirrors the runtime duplicate checks from useFileSidebar without Solid/Yjs.
function has(existingFiles: string[], path: string): boolean {
  return existingFiles.includes(path);
}
function folderHasFiles(existingFiles: string[], folder: string): boolean {
  return existingFiles.some((p) => p.startsWith(folder + "/"));
}
function pendingHas(pending: string[], folder: string): boolean {
  return pending.includes(folder);
}

describe("normalizeFile", () => {
  test("appends .typ when missing", () => {
    expect(normalizeFile("foo", "")).toBe("/foo.typ");
  });

  test("keeps .typ when already present", () => {
    expect(normalizeFile("foo.typ", "")).toBe("/foo.typ");
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

  test("returns empty string for blank input", () => {
    expect(normalizeFile("", "/a")).toBe("");
    expect(normalizeFile("   ", "/a")).toBe("");
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
      expect(normalizeFile("../../../../escape", "/a/b")).toBe("/escape.typ");
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

  test("returns empty string for blank input", () => {
    expect(normalizeFolder("", "/a")).toBe("");
    expect(normalizeFolder("   ", "/a")).toBe("");
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
      expect(normalizeFolder("../../../../x", "/a/b")).toBe("/x");
    });

    test(".. in the middle of a path is resolved", () => {
      expect(normalizeFolder("sub/../other", "/a")).toBe("/a/other");
    });
  });
});

describe("folder creation with simulated structure", () => {
  const files = ["/main.typ", "/a/b.typ", "/a/c.typ", "/x/y/z.typ"];

  test(".. name resolves to parent — detected as duplicate when parent has files", () => {
    // User types ".." as folder name inside /a/b → resolves to /a
    const folder = normalizeFolder("..", "/a/b");
    expect(folder).toBe("/a");
    expect(folderHasFiles(files, folder)).toBe(true);
  });

  test("deep traversal to existing folder is detected as duplicate", () => {
    const folder = normalizeFolder("../../a", "/x/y");
    expect(folder).toBe("/a");
    expect(folderHasFiles(files, folder)).toBe(true);
  });

  test("traversal to non-existent folder passes the duplicate check", () => {
    const folder = normalizeFolder("../new", "/a");
    expect(folder).toBe("/new");
    expect(folderHasFiles(files, folder)).toBe(false);
    expect(pendingHas([], folder)).toBe(false);
  });

  test("../../main.typ from /a/b resolves to /main.typ and is detected as duplicate", () => {
    const path = normalizeFile("../../main", "/a/b");
    expect(path).toBe("/main.typ");
    expect(has(files, path)).toBe(true);
  });

  test("traversal that exceeds root is clamped — resolves against root-level files", () => {
    // /a has no root sibling, but /main.typ is at root
    const path = normalizeFile("../../../main", "/a");
    expect(path).toBe("/main.typ");
    expect(has(files, path)).toBe(true);
  });

  test(".. to root-level folder is caught by the empty-result guard", () => {
    // normalizeFolder returns "" when resolved path is "/"
    const folder = normalizeFolder("..", "/a");
    expect(folder).toBe("");
    // handler treats "" as a no-op / invalid, so no duplicate check fires
  });
});
