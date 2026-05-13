import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import * as Y from "yjs";

import {
  dirOf,
  joinPath,
  leafOf,
  MAIN_PATH,
  normalizeFile,
  normalizeFolder,
} from "../../../lib/paths";
import { useProjectContext } from "../ProjectContext";
import { buildTree } from "./tree";
import type { DialogState } from "./types";

/** Build the user-facing "already exists" message for a path. */
const existsMsg = (path: string) => `"${path.replace(/^\//, "")}" already exists.`;

const copyText = (src: Y.Text): Y.Text => {
  const copy = new Y.Text();
  copy.insert(0, src.toJSON());
  return copy;
};

/**
 * Owns all reactive state and operations for the file sidebar. Returns plain
 * accessors and handlers - the JSX layer is pure rendering.
 */
export function useFileSidebar() {
  const ctx = useProjectContext();
  // Sidebar only mounts inside `ctx.ready()`, so `files` is non-null.
  const files = ctx.collab.files!;
  const [paths, setPaths] = createSignal<string[]>([]);
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  // Folders the user created via "New folder" that don't yet contain any file.
  // Local to this client; not propagated to collaborators. Materializes (and
  // is removed from here) the moment a file lands inside.
  const [pendingFolders, setPendingFolders] = createSignal(new Set<string>());
  const [dialog, setDialog] = createSignal<DialogState | null>(null);
  const [drag, setDrag] = createStore<{ source: string | null; over: string | null }>({
    source: null,
    over: null,
  });

  // Mirror Y.Map keys into a Solid signal so the list re-renders on any
  // mutation (local or remote).
  createEffect(() => {
    const refresh = () => setPaths([...files.keys()]);
    refresh();
    files.observe(refresh);
    onCleanup(() => {
      files.unobserve(refresh);
    });
  });

  // Drop pending entries that became "real" (a file was added under them).
  createEffect(() => {
    const all = paths();
    setPendingFolders((prev) => {
      const next = new Set([...prev].filter((f) => !all.some((p) => p.startsWith(f + "/"))));
      return next.size < prev.size ? next : prev;
    });
  });

  const tree = createMemo(() => buildTree(paths(), pendingFolders(), collapsed()));

  const close = () => setDialog(null);
  const has = (path: string) => files.has(path);
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
    const text = files.get(oldPath);
    if (!text) return;
    files.doc?.transact(() => {
      files.set(newPath, copyText(text));
      files.delete(oldPath);
    });
  };

  const moveFolder = (oldFolder: string, newFolder: string) => {
    const moves: [string, string][] = [];
    for (const p of files.keys()) {
      if (p === oldFolder || p.startsWith(oldFolder + "/")) {
        moves.push([p, newFolder + p.slice(oldFolder.length)]);
      }
    }
    files.doc?.transact(() => {
      for (const [from, to] of moves) {
        const text = files.get(from);
        if (!text) continue;
        files.set(to, copyText(text));
        files.delete(from);
      }
    });
    const active = ctx.activeFile();
    const moved = moves.find(([from]) => from === active);
    if (moved) ctx.setActiveFile(moved[1]);
  };

  // File operations ────────────────────────────────────────────────────────
  // All file/folder ops return `string` (inline error to show in the dialog,
  // dialog stays open) or `undefined` (success — PromptDialog closes itself).

  const handleNewFile = (dir: string, rawName: string): string | undefined => {
    const path = normalizeFile(rawName, dir);
    if (!path) return undefined;
    if (has(path)) return existsMsg(path);
    files.set(path, new Y.Text());
    ctx.setActiveFile(path);
    return undefined;
  };

  const handleRenameFile = (oldPath: string, rawName: string): string | undefined => {
    if (isLocked(oldPath)) return undefined;
    const newPath = normalizeFile(rawName, dirOf(oldPath));
    if (!newPath || newPath === oldPath) return undefined;
    if (has(newPath)) return existsMsg(newPath);
    movePath(oldPath, newPath);
    if (ctx.activeFile() === oldPath) ctx.setActiveFile(newPath);
    return undefined;
  };

  const handleDuplicateFile = (sourcePath: string, rawName: string): string | undefined => {
    const newPath = normalizeFile(rawName, dirOf(sourcePath));
    if (!newPath) return undefined;
    if (has(newPath)) return existsMsg(newPath);
    const source = files.get(sourcePath);
    if (!source) return undefined;
    files.set(newPath, copyText(source));
    return undefined;
  };

  const handleDeleteFile = (path: string) => {
    if (isLocked(path) || files.size <= 1) {
      close();
      return;
    }
    files.delete(path);
    if (ctx.activeFile() === path) {
      const next = [...files.keys()][0];
      if (next) ctx.setActiveFile(next);
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
      [...files.keys()].some((p) => p === newFolder || p.startsWith(newFolder + "/"))
    ) {
      return existsMsg(newFolder);
    }
    // Rewrite any pending entries with the matching prefix.
    setPendingFolders((prev) => {
      const under = (p: string) => p === oldFolder || p.startsWith(oldFolder + "/");
      if (![...prev].some((p) => under(p))) return prev;
      return new Set([...prev].map((p) => (under(p) ? newFolder + p.slice(oldFolder.length) : p)));
    });
    if (folderHasFiles(oldFolder)) moveFolder(oldFolder, newFolder);
    return undefined;
  };

  const handleDeleteFolder = (folder: string) => {
    const toDelete = [...files.keys()].filter((p) => p === folder || p.startsWith(folder + "/"));
    if (toDelete.length === files.size) {
      close();
      return;
    }
    setPendingFolders((prev) => {
      const next = new Set([...prev].filter((p) => p !== folder && !p.startsWith(folder + "/")));
      return next.size < prev.size ? next : prev;
    });
    if (toDelete.length > 0) {
      files.doc?.transact(() => {
        for (const p of toDelete) files.delete(p);
      });
      if (toDelete.includes(ctx.activeFile())) {
        const next = [...files.keys()][0];
        if (next) ctx.setActiveFile(next);
      }
    }
    close();
  };

  // Drag and drop ──────────────────────────────────────────────────────────

  const completeDrop = (e: DragEvent, destFor: (src: string) => string) => {
    e.preventDefault();
    const src = e.dataTransfer?.getData("text/plain");
    setDrag({ source: null, over: null });
    if (!src || isLocked(src)) return;
    const dest = destFor(src);
    if (dest === src || has(dest)) return;
    movePath(src, dest);
    if (ctx.activeFile() === src) ctx.setActiveFile(dest);
  };

  const onFileDragStart = (e: DragEvent, path: string) => {
    if (isLocked(path)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer?.setData("text/plain", path);
    setDrag({ source: path, over: null });
  };
  const onDragEnd = () => {
    setDrag({ source: null, over: null });
  };
  const onFolderDragOver = (e: DragEvent, folder: string) => {
    if (!drag.source) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag("over", folder);
  };
  const onFolderDrop = (e: DragEvent, folder: string) => {
    e.stopPropagation();
    completeDrop(e, (src) => joinPath(folder, leafOf(src)));
  };
  const onRootDragOver = (e: DragEvent) => {
    if (!drag.source) return;
    e.preventDefault();
    setDrag("over", "");
  };
  const onRootDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDrag("over", null);
  };
  const clearDragOver = () => {
    setDrag("over", null);
  };
  const onRootDrop = (e: DragEvent) => {
    completeDrop(e, (src) => `/${leafOf(src)}`);
  };

  return {
    tree,
    dialog,
    setDialog,
    close,
    dialogOf,
    drag,
    activeFile: ctx.activeFile,
    canDeleteFile: (path: string) => !isLocked(path) && files.size > 1,
    isLocked,
    onSelectFile: ctx.setActiveFile,
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
