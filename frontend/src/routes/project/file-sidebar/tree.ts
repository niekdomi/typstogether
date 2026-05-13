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
 * - Folders are derived from path prefixes (a folder exists if a path lives
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
    for (let dir = folder; dir; dir = dirOf(dir)) {
      folders.add(dir);
    }
  };
  for (const path of paths) {
    addFolderAndAncestors(dirOf(path));
  }
  for (const folder of pendingFolders) {
    addFolderAndAncestors(folder);
  }

  const childrenOf = new Map<string, Item[]>();
  const ensure = (parent: string): Item[] => {
    const existing = childrenOf.get(parent);
    if (existing) {
      return existing;
    }

    const arr: Item[] = [];
    childrenOf.set(parent, arr);
    return arr;
  };

  for (const folder of folders) {
    ensure(dirOf(folder)).push({ kind: "folder", path: folder, name: leafOf(folder) });
  }
  for (const path of paths) {
    ensure(dirOf(path)).push({ kind: "file", path, name: leafOf(path) });
  }

  const kindRank: Record<Item["kind"], number> = { folder: 0, file: 1 };
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || a.name.localeCompare(b.name));
  }

  const out: FlatNode[] = [];
  const visit = (parent: string, depth: number) => {
    for (const { kind, path, name } of childrenOf.get(parent) ?? []) {
      if (kind === "folder") {
        const isCollapsed = collapsed.has(path);
        out.push({ kind, path, depth, name, collapsed: isCollapsed });

        if (!isCollapsed) {
          visit(path, depth + 1);
        }
      } else {
        out.push({ kind, path, depth, name });
      }
    }
  };
  visit("", 0);

  return out;
}
