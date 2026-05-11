import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import * as Y from "yjs";

import {
  dirOf,
  joinPath,
  leafOf,
  MAIN_PATH,
  normalizeFile,
  normalizeFolder,
} from "../../../lib/paths";
import { buildTree } from "./tree";
import type { DialogState, FileSidebarProps } from "./types";

/** Build the user-facing "already exists" message for a path. */
const existsMsg = (path: string) => `"${path.replace(/^\//, "")}" already exists.`;

/**
 * Owns all reactive state and operations for the file sidebar. Returns plain
 * accessors and handlers — the JSX layer is pure rendering.
 */
export function useFileSidebar(props: FileSidebarProps) {
  const [paths, setPaths] = createSignal<string[]>([]);
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  // Folders the user created via "New folder" that don't yet contain any file.
  // Local to this client; not propagated to collaborators. Materializes (and
  // is removed from here) the moment a file lands inside.
  const [pendingFolders, setPendingFolders] = createSignal(new Set<string>());
  const [dialog, setDialog] = createSignal<DialogState | null>(null);
  const [dragging, setDragging] = createSignal<string | null>(null);
  const [dragOver, setDragOver] = createSignal<string | null>(null);

  // Mirror Y.Map keys into a Solid signal so the list re-renders on any
  // mutation (local or remote).
  createEffect(() => {
    const map = props.files;
    const refresh = () => setPaths([...map.keys()]);
    refresh();
    map.observe(refresh);
    onCleanup(() => {
      map.unobserve(refresh);
    });
  });

  // Drop pending entries that became "real" (a file was added under them).
  createEffect(() => {
    const all = paths();
    setPendingFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const folder of prev) {
        if (all.some((p) => p.startsWith(folder + "/"))) {
          next.delete(folder);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

  const tree = createMemo(() => buildTree(paths(), pendingFolders(), collapsed()));

  const close = () => setDialog(null);
  const has = (path: string) => props.files.has(path);
  const folderHasFiles = (folder: string) => paths().some((p) => p.startsWith(folder + "/"));
  const isLocked = (path: string) => path === MAIN_PATH;

  // Narrow the dialog union for type-safe rendering.
  const dialogOf =
    <T extends DialogState["type"]>(type: T) =>
    () => {
      const s = dialog();
      return s?.type === type ? (s as Extract<DialogState, { type: T }>) : undefined;
    };

  const toggleCollapsed = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Path moves ────────────────────────────────────────────────────────────
  // Y.Text instances can't be transferred between Y.Map keys, so we copy
  // content and delete the old key.

  const movePath = (oldPath: string, newPath: string) => {
    const text = props.files.get(oldPath);
    if (!text) return;
    const copy = new Y.Text();
    copy.insert(0, text.toJSON());
    props.files.doc?.transact(() => {
      props.files.set(newPath, copy);
      props.files.delete(oldPath);
    });
  };

  const moveFolder = (oldFolder: string, newFolder: string) => {
    const moves: [string, string][] = [];
    for (const p of props.files.keys()) {
      if (p === oldFolder || p.startsWith(oldFolder + "/")) {
        moves.push([p, newFolder + p.slice(oldFolder.length)]);
      }
    }
    props.files.doc?.transact(() => {
      for (const [from, to] of moves) {
        const text = props.files.get(from);
        if (!text) continue;
        const copy = new Y.Text();
        copy.insert(0, text.toJSON());
        props.files.set(to, copy);
        props.files.delete(from);
      }
    });
    const active = props.activeFile();
    const moved = moves.find(([from]) => from === active);
    if (moved) props.setActiveFile(moved[1]);
  };

  // File operations ────────────────────────────────────────────────────────
  // All file/folder ops return `string` (inline error to show in the dialog,
  // dialog stays open) or `undefined` (success — PromptDialog closes itself).

  const handleNewFile = (dir: string, rawName: string): string | undefined => {
    const path = normalizeFile(rawName, dir);
    if (!path) return undefined;
    if (has(path)) return existsMsg(path);
    props.files.set(path, new Y.Text());
    props.setActiveFile(path);
    return undefined;
  };

  const handleRenameFile = (oldPath: string, rawName: string): string | undefined => {
    if (isLocked(oldPath)) return undefined;
    const newPath = normalizeFile(rawName, dirOf(oldPath));
    if (!newPath || newPath === oldPath) return undefined;
    if (has(newPath)) return existsMsg(newPath);
    movePath(oldPath, newPath);
    if (props.activeFile() === oldPath) props.setActiveFile(newPath);
    return undefined;
  };

  const handleDuplicateFile = (sourcePath: string, rawName: string): string | undefined => {
    const newPath = normalizeFile(rawName, dirOf(sourcePath));
    if (!newPath) return undefined;
    if (has(newPath)) return existsMsg(newPath);
    const source = props.files.get(sourcePath);
    if (!source) return undefined;
    const copy = new Y.Text();
    copy.insert(0, source.toJSON());
    props.files.set(newPath, copy);
    return undefined;
  };

  const handleDeleteFile = (path: string) => {
    if (isLocked(path) || props.files.size <= 1) {
      close();
      return;
    }
    props.files.delete(path);
    if (props.activeFile() === path) {
      const next = [...props.files.keys()][0];
      if (next) props.setActiveFile(next);
    }
    close();
  };

  // Folder operations ──────────────────────────────────────────────────────

  const handleNewFolder = (dir: string, rawName: string): string | undefined => {
    const folder = normalizeFolder(rawName, dir);
    if (!folder) return undefined;
    if (pendingFolders().has(folder) || folderHasFiles(folder) || has(folder)) {
      return existsMsg(folder);
    }
    setPendingFolders((prev) => new Set([...prev, folder]));
    return undefined;
  };

  const handleRenameFolder = (oldFolder: string, rawName: string): string | undefined => {
    const leaf = rawName.trim().replace(/\/+$/, "");
    if (!leaf || leaf === leafOf(oldFolder)) return undefined;
    const newFolder = joinPath(dirOf(oldFolder), leaf);
    if (
      pendingFolders().has(newFolder) ||
      [...props.files.keys()].some((p) => p === newFolder || p.startsWith(newFolder + "/"))
    ) {
      return existsMsg(newFolder);
    }
    // Rewrite any pending entries with the matching prefix.
    setPendingFolders((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const p of prev) {
        if (p === oldFolder || p.startsWith(oldFolder + "/")) {
          next.add(newFolder + p.slice(oldFolder.length));
          changed = true;
        } else {
          next.add(p);
        }
      }
      return changed ? next : prev;
    });
    if (folderHasFiles(oldFolder)) moveFolder(oldFolder, newFolder);
    return undefined;
  };

  const handleDeleteFolder = (folder: string) => {
    const toDelete = [...props.files.keys()].filter(
      (p) => p === folder || p.startsWith(folder + "/")
    );
    if (toDelete.length === props.files.size) {
      close();
      return;
    }
    setPendingFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const p of prev) {
        if (p === folder || p.startsWith(folder + "/")) {
          next.delete(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    if (toDelete.length > 0) {
      props.files.doc?.transact(() => {
        for (const p of toDelete) props.files.delete(p);
      });
      if (toDelete.includes(props.activeFile())) {
        const next = [...props.files.keys()][0];
        if (next) props.setActiveFile(next);
      }
    }
    close();
  };

  // Drag and drop ──────────────────────────────────────────────────────────

  const onFileDragStart = (e: DragEvent, path: string) => {
    if (isLocked(path)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer?.setData("text/plain", path);
    setDragging(path);
  };
  const onDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };
  const onFolderDragOver = (e: DragEvent, folder: string) => {
    if (!dragging()) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(folder);
  };
  const onFolderDrop = (e: DragEvent, folder: string) => {
    e.preventDefault();
    e.stopPropagation();
    const src = e.dataTransfer?.getData("text/plain");
    setDragging(null);
    setDragOver(null);
    if (!src || isLocked(src)) return;
    const dest = joinPath(folder, leafOf(src));
    if (dest === src || has(dest)) return;
    movePath(src, dest);
    if (props.activeFile() === src) props.setActiveFile(dest);
  };
  const onRootDragOver = (e: DragEvent) => {
    if (!dragging()) return;
    e.preventDefault();
    setDragOver("");
  };
  const onRootDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(null);
  };
  const clearDragOver = () => setDragOver(null);
  const onRootDrop = (e: DragEvent) => {
    e.preventDefault();
    const src = e.dataTransfer?.getData("text/plain");
    setDragging(null);
    setDragOver(null);
    if (!src || isLocked(src)) return;
    const dest = `/${leafOf(src)}`;
    if (dest === src || has(dest)) return;
    movePath(src, dest);
    if (props.activeFile() === src) props.setActiveFile(dest);
  };

  return {
    tree,
    dialog,
    setDialog,
    close,
    dialogOf,
    dragging,
    dragOver,
    activeFile: props.activeFile,
    canDeleteFile: (path: string) => !isLocked(path) && props.files.size > 1,
    isLocked,
    onSelectFile: props.setActiveFile,
    toggleCollapsed,
    handleNewFile,
    handleRenameFile,
    handleDuplicateFile,
    handleDeleteFile,
    handleNewFolder,
    handleRenameFolder,
    handleDeleteFolder,
    onFileDragStart,
    onDragEnd,
    onFolderDragOver,
    onFolderDrop,
    onRootDragOver,
    onRootDragLeave,
    onRootDrop,
    clearDragOver,
  };
}

export type FileSidebarController = ReturnType<typeof useFileSidebar>;
