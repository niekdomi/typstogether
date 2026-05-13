import { describe, expect, test } from "bun:test";

import { buildTree } from "./tree";

const none = new Set<string>();

describe("buildTree", () => {
  test("empty input produces empty output", () => {
    expect(buildTree([], none, none)).toEqual([]);
  });

  test("root-level files appear at depth 0", () => {
    const nodes = buildTree(["/a.typ", "/b.typ"], none, none);
    expect(nodes).toEqual([
      { kind: "file", path: "/a.typ", depth: 0, name: "a.typ" },
      { kind: "file", path: "/b.typ", depth: 0, name: "b.typ" },
    ]);
  });

  test("folders are derived from path prefixes and appear before files", () => {
    const nodes = buildTree(["/docs/a.typ", "/b.typ"], none, none);
    expect(nodes).toEqual([
      { kind: "folder", path: "/docs", depth: 0, name: "docs", collapsed: false },
      { kind: "file", path: "/docs/a.typ", depth: 1, name: "a.typ" },
      { kind: "file", path: "/b.typ", depth: 0, name: "b.typ" },
    ]);
  });

  test("siblings sort folders before files, then alphabetically within each kind", () => {
    const nodes = buildTree(["/b.typ", "/a.typ", "/z/f.typ", "/m/f.typ"], none, none);
    const names = nodes.map((n) => n.name);
    expect(names).toEqual(["m", "f.typ", "z", "f.typ", "a.typ", "b.typ"]);
  });

  test("nested folders carry correct depth", () => {
    const nodes = buildTree(["/a/b/c.typ"], none, none);
    expect(nodes).toEqual([
      { kind: "folder", path: "/a", depth: 0, name: "a", collapsed: false },
      { kind: "folder", path: "/a/b", depth: 1, name: "b", collapsed: false },
      { kind: "file", path: "/a/b/c.typ", depth: 2, name: "c.typ" },
    ]);
  });

  test("pending (empty) folders appear in the tree", () => {
    const pending = new Set(["/empty"]);
    const nodes = buildTree([], pending, none);
    expect(nodes).toEqual([
      { kind: "folder", path: "/empty", depth: 0, name: "empty", collapsed: false },
    ]);
  });

  test("pending folder nested inside another pending folder", () => {
    const pending = new Set(["/a", "/a/b"]);
    const nodes = buildTree([], pending, none);
    expect(nodes).toEqual([
      { kind: "folder", path: "/a", depth: 0, name: "a", collapsed: false },
      { kind: "folder", path: "/a/b", depth: 1, name: "b", collapsed: false },
    ]);
  });

  test("collapsed folder hides its subtree", () => {
    const collapsed = new Set(["/docs"]);
    const nodes = buildTree(["/docs/a.typ", "/b.typ"], none, collapsed);
    expect(nodes).toEqual([
      { kind: "folder", path: "/docs", depth: 0, name: "docs", collapsed: true },
      { kind: "file", path: "/b.typ", depth: 0, name: "b.typ" },
    ]);
  });

  test("collapsing a parent hides the entire subtree including nested folders", () => {
    const collapsed = new Set(["/a"]);
    const nodes = buildTree(["/a/b/c.typ", "/a/d.typ"], none, collapsed);
    expect(nodes).toEqual([{ kind: "folder", path: "/a", depth: 0, name: "a", collapsed: true }]);
  });

  test("collapsing a child folder but not the parent shows the parent open", () => {
    const collapsed = new Set(["/a/b"]);
    const nodes = buildTree(["/a/b/c.typ"], none, collapsed);
    expect(nodes).toEqual([
      { kind: "folder", path: "/a", depth: 0, name: "a", collapsed: false },
      { kind: "folder", path: "/a/b", depth: 1, name: "b", collapsed: true },
    ]);
  });

  test("pending folder disappears from its position once a real file lands inside it", () => {
    const pending = new Set(["/docs"]);
    // A file inside /docs already exists → pending is redundant but harmless
    const nodes = buildTree(["/docs/a.typ"], pending, none);
    const folders = nodes.filter((n) => n.kind === "folder");
    expect(folders).toHaveLength(1);
    expect(folders[0]!.path).toBe("/docs");
  });
});
