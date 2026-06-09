import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { toast } from "somoto";
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
  // viewers, preview is local-only.
  const canPreview = (path: string) =>
    isTypFile(path) && files.has(path) && path !== ctx.collab.entry && !isPreviewing(path);
  const [paths, setPaths] = createSignal<string[]>([]);
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  // Folders the user created via "New folder" that don't yet contain any file.
  // Local to this client; not propagated to collaborators. Materializes (and
  // is removed from here) the moment a file lands inside.
  const [pendingFolders, setPendingFolders] = createSignal(new Set<string>());
  const [dialog, setDialog] = createSignal<DialogState | null>(null);
  // True while an OS file (not an internal file/folder move) is dragged over the
  // sidebar, so the upload affordance can light up.
  const [fileDragOver, setFileDragOver] = createSignal(false);
  // Count of asset uploads in flight (picker + drop), for the progress label.
  const [uploading, setUploading] = createSignal(0);
  const [drag, setDrag] = createStore<{
    source: string | null;
    sourceKind: "file" | "folder" | null;
    over: string | null;
  }>({
    source: null,
    sourceKind: null,
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
  // A folder already exists if anything (real file/asset, pending entry, or a
  // file living under it) occupies that path. Used to reject move collisions.
  const folderExists = (folder: string) =>
    has(folder) || folderHasFiles(folder) || pendingFolders().has(folder);
  // Locked when the project's compile entry lives at or under the folder:
  // moving it would orphan the synced entry reference, just like dragging the
  // entry file itself is blocked.
  const isFolderLocked = (folder: string) =>
    ctx.collab.entry === folder || ctx.collab.entry.startsWith(folder + "/");

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

    // Folders are derived from file paths, so emptying one makes it vanish.
    // Keep it as a pending folder
    const oldParent = dirOf(oldPath);
    if (oldParent && oldParent !== dirOf(newPath)) {
      setPendingFolders((prev) => (prev.has(oldParent) ? prev : new Set([...prev, oldParent])));
    }
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

  // Relocate a folder and everything beneath it. Rewrites locally-pending
  // (empty) folder entries by prefix and moves any real files/assets across.
  const relocateFolder = (oldFolder: string, newFolder: string) => {
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

  const uploadOne = async (dir: string, file: File): Promise<string | undefined> => {
    const path = normalizeAsset(file.name, dir);
    if (!path) return "Invalid file name.";
    if (has(path)) return existsMsg(path);
    setUploading((n) => n + 1);
    try {
      const { id } = await uploadAsset(projectId(), file);
      assets.set(path, id);
      ctx.setActiveFile(path);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : "Upload failed.";
    } finally {
      setUploading((n) => n - 1);
    }
  };

  // Upload a batch of files as assets in parallel, summarizing any failures in
  // one toast.
  const handleUploadAssets = async (dir: string, list: File[]): Promise<void> => {
    const errors = await Promise.all(list.map((file) => uploadOne(dir, file)));
    const failed = errors.filter((m): m is string => m !== undefined);
    const first = failed[0];
    if (first) {
      toast.error(failed.length === 1 ? first : `${first} (+${String(failed.length - 1)} more)`);
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

    relocateFolder(oldFolder, newFolder);

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

    // Deleting a nested folder shouldn't take its now-empty parent down with it.
    const parent = dirOf(folder);
    setPendingFolders((prev) => {
      const next = new Set([...prev].filter((p) => p !== folder && !p.startsWith(folder + "/")));
      if (parent) {
        next.add(parent);
      }
      return next;
    });

    if (toDelete.length > 0) {
      files.doc?.transact(() => {
        for (const p of textKeys) {
          files.delete(p);
        }
        for (const p of assetKeys) {
          assets.delete(p);
        }
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

  // Resolve a drop into target directory `destDir` ("" is root). A file/asset
  // moves a single path; a folder relocates its whole subtree and is barred
  // from landing on itself or inside its own subtree.
  const completeDrop = (e: DragEvent, destDir: string) => {
    e.preventDefault();

    const src = e.dataTransfer?.getData("text/plain");
    const kind = drag.sourceKind;

    setDrag({ source: null, sourceKind: null, over: null });

    if (!src) {
      return;
    }

    if (kind === "folder") {
      const dest = joinPath(destDir, leafOf(src));

      if (isFolderLocked(src) || dest === src || dest.startsWith(src + "/") || folderExists(dest)) {
        return;
      }

      relocateFolder(src, dest);
      return;
    }

    if (isLocked(src)) {
      return;
    }

    const dest = joinPath(destDir, leafOf(src));
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
    setDrag({ source: path, sourceKind: "file", over: null });
  };

  const onFolderDragStart = (e: DragEvent, folder: string) => {
    if (isFolderLocked(folder)) {
      e.preventDefault();
      return;
    }

    e.dataTransfer?.setData("text/plain", folder);
    setDrag({ source: folder, sourceKind: "folder", over: null });
  };

  const onDragEnd = () => {
    setDrag({ source: null, sourceKind: null, over: null });
  };

  // A dragged folder can't target itself or any folder within its own subtree;
  // file/asset drags accept any folder.
  const isValidFolderTarget = (folder: string) => {
    if (drag.sourceKind !== "folder") {
      return true;
    }

    const src = drag.source;
    return !!src && folder !== src && !folder.startsWith(src + "/");
  };

  // An OS file drag (vs an internal file/folder move). preventDefault makes the
  // sidebar a real drop target so the drop fires here instead of the browser
  // opening the file; the lit-up upload affordance is the cue.
  const onFileDragOver = (e: DragEvent): boolean => {
    if (!e.dataTransfer?.types.includes("Files")) return false;
    e.preventDefault();
    setFileDragOver(true);
    return true;
  };

  const endFileDrag = () => setFileDragOver(false);

  const onFolderDragOver = (e: DragEvent, folder: string) => {
    if (onFileDragOver(e)) {
      e.stopPropagation();
      return;
    }
    if (!drag.source) {
      return;
    }

    // Always swallow the event so an invalid target doesn't bubble up and
    // light up the root drop zone instead.
    e.stopPropagation();
    if (!isValidFolderTarget(folder)) {
      setDrag("over", null);
      return;
    }

    e.preventDefault();
    setDrag("over", folder);
  };

  const onFolderDrop = (e: DragEvent, folder: string) => {
    e.stopPropagation();
    completeDrop(e, folder);
  };

  const onRootDragOver = (e: DragEvent) => {
    if (onFileDragOver(e)) {
      return;
    }
    if (!drag.source) {
      return;
    }
    e.preventDefault();
    setDrag("over", "");
  };

  const onRootDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDrag("over", null);
      endFileDrag();
    }
  };

  const clearDragOver = () => {
    setDrag("over", null);
  };

  const onRootDrop = (e: DragEvent) => {
    completeDrop(e, "");
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
    isFolderLocked,
    isAsset,
    isReadOnly: ctx.isReadOnly,
    onSelectFile: ctx.setActiveFile,
    toggleCollapsed,
    handleNewFile,
    handleRenameFile,
    handleDuplicateFile,
    handleDeleteFile,
    handleNewFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleUploadAssets,
    togglePreview,
    onFileDragStart,
    onFolderDragStart,
    onDragEnd,
    onFolderDragOver,
    onFolderDrop,
    onRootDragOver,
    onRootDragLeave,
    onRootDrop,
    clearDragOver,
    fileDragOver,
    endFileDrag,
    uploading,
  };
}

export type FileSidebarController = ReturnType<typeof useFileSidebar>;
