import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import * as Y from "yjs";

import { uploadAsset } from "../../../lib/assets/upload";
import {
  dirOf,
  isTypFile,
  joinPath,
  leafOf,
  normalizeAsset,
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
  // Sidebar only mounts inside `ctx.ready()`, so both maps are non-null.
  const files = ctx.collab.files!;
  const assets = ctx.collab.assets!;
  const projectId = ctx.projectId;
  // Lock is tied to the *project's* entry (Y.Doc), not the per-user preview:
  // a viewer shouldn't be able to delete the canonical entry, but local
  // preview is ephemeral so the locked file shouldn't shift with it.
  const isLocked = (path: string) => path === ctx.collab.entry;
  const isPreviewing = (path: string) => ctx.previewEntry() === path;
  // Preview eligibility: .typ source files only, never the project's own entry
  // (that file shows the "entry" badge and is the default compile target), and
  // not the file already being previewed. Available to all sessions including
  // viewers — preview is local-only.
  const canPreview = (path: string) =>
    isTypFile(path) && files.has(path) && path !== ctx.collab.entry && !isPreviewing(path);
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

  // Mirror Y.Map keys from both maps into a Solid signal so the list re-renders
  // on any mutation (local or remote).
  createEffect(() => {
    const refresh = () => setPaths([...files.keys(), ...assets.keys()]);
    refresh();
    files.observe(refresh);
    assets.observe(refresh);
    onCleanup(() => {
      files.unobserve(refresh);
      assets.unobserve(refresh);
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
  const has = (path: string) => files.has(path) || assets.has(path);
  const isAsset = (path: string) => assets.has(path);
  const folderHasFiles = (folder: string) => paths().some((p) => p.startsWith(folder + "/"));
  const totalCount = () => files.size + assets.size;

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

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };

  // Path moves ────────────────────────────────────────────────────────────
  // Text values: Y.Text instances can't be transferred between Y.Map keys, so
  // we copy content and delete the old key. Asset values: the blob_id string is
  // a primitive, so a plain set/delete is enough.

  const movePath = (oldPath: string, newPath: string) => {
    files.doc?.transact(() => {
      const text = files.get(oldPath);
      if (text) {
        files.set(newPath, copyText(text));
        files.delete(oldPath);
        return;
      }

      const sha = assets.get(oldPath);
      if (sha) {
        assets.set(newPath, sha);
        assets.delete(oldPath);
      }
    });
  };

  const moveFolder = (oldFolder: string, newFolder: string) => {
    const moves: [string, string][] = [];
    for (const path of files.keys()) {
      if (path.startsWith(oldFolder + "/")) {
        moves.push([path, newFolder + path.slice(oldFolder.length)]);
      }
    }
    for (const path of assets.keys()) {
      if (path.startsWith(oldFolder + "/")) {
        moves.push([path, newFolder + path.slice(oldFolder.length)]);
      }
    }

    files.doc?.transact(() => {
      for (const [from, to] of moves) {
        const text = files.get(from);
        if (text) {
          files.set(to, copyText(text));
          files.delete(from);
          continue;
        }

        const sha = assets.get(from);
        if (sha) {
          assets.set(to, sha);
          assets.delete(from);
        }
      }
    });

    const active = ctx.activeFile();
    const moved = moves.find(([from]) => from === active);
    if (moved) {
      ctx.setActiveFile(moved[1]);
    }
  };

  // File operations ────────────────────────────────────────────────────────
  // All file/folder ops return `string` (inline error to show in the dialog,
  // dialog stays open) or `undefined` (success -> PromptDialog closes itself).

  const handleNewFile = (dir: string, rawName: string): string | undefined => {
    if (rawName.trimEnd().endsWith("/")) {
      return "File name cannot end with /";
    }

    const path = normalizeFile(rawName, dir);
    if (!path) {
      return undefined;
    }
    if (has(path)) {
      return existsMsg(path);
    }

    files.set(path, new Y.Text());
    ctx.setActiveFile(path);

    return undefined;
  };

  // Pick the right path normalizer: text files force `.typ`; assets preserve
  // their original extension.
  const normalizeForPath = (path: string, rawName: string, dir: string): string =>
    isAsset(path) ? normalizeAsset(rawName, dir) : normalizeFile(rawName, dir);

  const handleRenameFile = (oldPath: string, rawName: string): string | undefined => {
    if (isLocked(oldPath)) {
      return undefined;
    }

    if (rawName.trimEnd().endsWith("/")) {
      return "File name cannot end with /";
    }

    const newPath = normalizeForPath(oldPath, rawName, dirOf(oldPath));
    if (newPath === oldPath) {
      return undefined;
    }
    if (has(newPath)) {
      return existsMsg(newPath);
    }
    movePath(oldPath, newPath);

    if (ctx.activeFile() === oldPath) {
      ctx.setActiveFile(newPath);
    }

    return undefined;
  };

  const handleDuplicateFile = (sourcePath: string, rawName: string): string | undefined => {
    if (rawName.trimEnd().endsWith("/")) {
      return "File name cannot end with /";
    }

    const newPath = normalizeForPath(sourcePath, rawName, dirOf(sourcePath));
    if (!newPath) {
      return undefined;
    }
    if (has(newPath)) {
      return existsMsg(newPath);
    }

    const sha = assets.get(sourcePath);
    if (sha) {
      // Asset duplicate is free: same blob, two paths.
      assets.set(newPath, sha);
      return undefined;
    }

    const source = files.get(sourcePath);
    if (!source) {
      return undefined;
    }

    files.set(newPath, copyText(source));
    return undefined;
  };

  const handleDeleteFile = (path: string) => {
    if (isLocked(path) || totalCount() <= 1) {
      close();
      return;
    }

    if (assets.has(path)) {
      assets.delete(path);
    } else {
      files.delete(path);
    }

    if (ctx.activeFile() === path) {
      const next = [...files.keys()][0] ?? [...assets.keys()][0];
      if (next) {
        ctx.setActiveFile(next);
      }
    }

    close();
  };

  // Asset uploads ──────────────────────────────────────────────────────────

  const handleUploadAsset = async (dir: string, file: File): Promise<string | undefined> => {
    const path = normalizeAsset(file.name, dir);
    if (!path) return "Invalid file name.";
    if (has(path)) return existsMsg(path);
    try {
      const { id } = await uploadAsset(projectId(), file);
      assets.set(path, id);
      ctx.setActiveFile(path);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : "Upload failed.";
    }
  };

  // Folder operations ──────────────────────────────────────────────────────

  const handleNewFolder = (dir: string, rawName: string): string | undefined => {
    const folder = normalizeFolder(rawName, dir);
    if (!folder) {
      return "Invalid folder name";
    }

    if (pendingFolders().has(folder) || folderHasFiles(folder) || has(folder)) {
      return existsMsg(folder);
    }
    setPendingFolders((prev) => new Set([...prev, folder]));

    return undefined;
  };

  const handleRenameFolder = (oldFolder: string, rawName: string): string | undefined => {
    const newFolder = normalizeFolder(rawName, dirOf(oldFolder));
    if (!newFolder) {
      return "Invalid folder name";
    }
    if (newFolder === oldFolder) {
      return undefined;
    }

    if (pendingFolders().has(newFolder) || folderHasFiles(newFolder)) {
      return existsMsg(newFolder);
    }

    // Rewrite any pending entries with the matching prefix.
    setPendingFolders((prev) => {
      const under = (p: string) => p === oldFolder || p.startsWith(oldFolder + "/");
      if (![...prev].some((p) => under(p))) {
        return prev;
      }
      return new Set([...prev].map((p) => (under(p) ? newFolder + p.slice(oldFolder.length) : p)));
    });

    if (folderHasFiles(oldFolder)) {
      moveFolder(oldFolder, newFolder);
    }

    return undefined;
  };

  const handleDeleteFolder = (folder: string) => {
    const textKeys = [...files.keys()].filter((p) => p.startsWith(folder + "/"));
    const assetKeys = [...assets.keys()].filter((p) => p.startsWith(folder + "/"));
    const toDelete = [...textKeys, ...assetKeys];
    if (toDelete.length === totalCount()) {
      close();
      return;
    }

    setPendingFolders((prev) => {
      const next = new Set([...prev].filter((p) => p !== folder && !p.startsWith(folder + "/")));
      return next.size < prev.size ? next : prev;
    });

    if (toDelete.length > 0) {
      files.doc?.transact(() => {
        for (const p of textKeys) files.delete(p);
        for (const p of assetKeys) assets.delete(p);
      });

      if (toDelete.includes(ctx.activeFile())) {
        const next = [...files.keys()][0] ?? [...assets.keys()][0];
        if (next) {
          ctx.setActiveFile(next);
        }
      }
    }

    close();
  };

  // Drag and drop ──────────────────────────────────────────────────────────

  const completeDrop = (e: DragEvent, destFor: (src: string) => string) => {
    e.preventDefault();
    const src = e.dataTransfer?.getData("text/plain");
    setDrag({ source: null, over: null });

    if (!src || isLocked(src)) {
      return;
    }

    const dest = destFor(src);
    if (dest === src || has(dest)) {
      return;
    }

    movePath(src, dest);
    if (ctx.activeFile() === src) {
      ctx.setActiveFile(dest);
    }
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
    if (!drag.source) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    setDrag("over", folder);
  };

  const onFolderDrop = (e: DragEvent, folder: string) => {
    e.stopPropagation();
    completeDrop(e, (src) => joinPath(folder, leafOf(src)));
  };

  const onRootDragOver = (e: DragEvent) => {
    if (!drag.source) {
      return;
    }
    e.preventDefault();
    setDrag("over", "");
  };

  const onRootDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDrag("over", null);
    }
  };

  const clearDragOver = () => {
    setDrag("over", null);
  };

  const onRootDrop = (e: DragEvent) => {
    completeDrop(e, (src) => `/${leafOf(src)}`);
  };

  // Memory-only override of the compile entry. Local to this client; doesn't
  // mutate the Y.Doc or affect other collaborators. Resets on page reload.
  const togglePreview = (path: string): void => {
    if (isPreviewing(path)) {
      ctx.setPreviewEntry(null);
    } else if (canPreview(path)) {
      ctx.setPreviewEntry(path);
    }
  };

  return {
    tree,
    dialog,
    setDialog,
    close,
    dialogOf,
    drag,
    activeFile: ctx.activeFile,
    canDeleteFile: (path: string) => !isLocked(path) && totalCount() > 1,
    canPreview,
    isPreviewing,
    isLocked,
    isAsset,
    onSelectFile: ctx.setActiveFile,
    toggleCollapsed,
    handleNewFile,
    handleRenameFile,
    handleDuplicateFile,
    handleDeleteFile,
    handleNewFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleUploadAsset,
    togglePreview,
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
