import { dirOf, leafOf } from "../../../lib/paths";
import type { FlatNode } from "./types";

interface Item {
  kind: "file" | "folder";
  path: string;
  name: string;
}

/**
 * Build a flat depth-first list of file/folder nodes from a list of file
 * paths and a set of locally-pending (empty) folders.
 *
 * - Folders are derived from path prefixes (a folder exists iff a path lives
 *   under it). Pending folders are merged in so user-created empty folders
 *   stay visible until a file lands inside.
 * - Folders sort before files; alphabetical within each kind.
 * - Collapsed folders skip their subtree.
 */
export function buildTree(
  paths: string[],
  pendingFolders: Set<string>,
  collapsed: Set<string>
): FlatNode[] {
  const folders = new Set<string>();
  const addFolderAndAncestors = (folder: string) => {
    let dir = folder;
    while (dir) {
      folders.add(dir);
      dir = dirOf(dir);
    }
  };
  for (const path of paths) addFolderAndAncestors(dirOf(path));
  for (const folder of pendingFolders) addFolderAndAncestors(folder);

  const childrenOf = new Map<string, Item[]>();
  const ensure = (parent: string): Item[] => {
    let arr = childrenOf.get(parent);
    if (!arr) {
      arr = [];
      childrenOf.set(parent, arr);
    }
    return arr;
  };

  for (const folder of folders) {
    ensure(dirOf(folder)).push({ kind: "folder", path: folder, name: leafOf(folder) });
  }
  for (const path of paths) {
    ensure(dirOf(path)).push({ kind: "file", path, name: leafOf(path) });
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  const out: FlatNode[] = [];
  const visit = (parent: string, depth: number) => {
    for (const item of childrenOf.get(parent) ?? []) {
      if (item.kind === "folder") {
        const isCollapsed = collapsed.has(item.path);
        out.push({
          kind: "folder",
          path: item.path,
          depth,
          name: item.name,
          collapsed: isCollapsed,
        });
        if (!isCollapsed) visit(item.path, depth + 1);
      } else {
        out.push({ kind: "file", path: item.path, depth, name: item.name });
      }
    }
  };
  visit("", 0);
  return out;
}
