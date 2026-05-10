import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineFileText,
  TbOutlineFolder,
} from "solid-icons/tb";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import * as Y from "yjs";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/ui/context-menu";
import { cx } from "../../components/ui/cva";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../components/ui/sidebar";
import { dirOf, joinPath, leafOf, normalizeFile, normalizeFolder } from "../../lib/paths";
import ConfirmDialog from "../dashboard/ConfirmDialog";
import PromptDialog from "../dashboard/PromptDialog";

// Tree model ──────────────────────────────────────────────────────────────────

type FlatNode =
  | { kind: "file"; path: string; depth: number; name: string }
  | { kind: "folder"; path: string; depth: number; name: string; collapsed: boolean };

/**
 * Build a flat depth-first list of file/folder nodes from a list of file paths.
 * Folders are derived from path prefixes; collapsed folders skip their subtree.
 */
interface Item {
  kind: "file" | "folder";
  path: string;
  name: string;
}

function buildTree(
  paths: string[],
  pendingFolders: Set<string>,
  collapsed: Set<string>
): FlatNode[] {
  // Every directory implied by any path becomes a folder node.
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

  // Folders sort before files; alphabetical within each kind.
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

// Dialogues ─────────────────────────────────────────────────────────────────────

type ConflictFlow = "renameFile" | "duplicateFile" | "newFile" | "moveFile";

type DialogState =
  | { type: "renameFile"; path: string }
  | { type: "duplicateFile"; path: string }
  | { type: "deleteFile"; path: string }
  | { type: "newFile"; dir: string }
  | { type: "newFolder"; dir: string }
  | { type: "renameFolder"; path: string }
  | { type: "deleteFolder"; path: string }
  | { type: "conflict"; proposedPath: string; sourcePath: string; flow: ConflictFlow };

// Component ───────────────────────────────────────────────────────────────────

interface Props {
  files: Y.Map<Y.Text>;
  activeFile: () => string;
  setActiveFile: (path: string) => void;
}

export default function FileSidebar(props: Props) {
  const [paths, setPaths] = createSignal<string[]>([]);
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  // Folders the user created via "New folder" that don't yet contain any file.
  // Local to this client; not propagated to collaborators. Materializes
  // (and is removed from here) the moment a file lands inside.
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

  /** Whether a folder currently has any file under it. */
  const folderHasFiles = (folder: string) => paths().some((p) => p.startsWith(folder + "/"));

  const close = () => setDialog(null);
  const has = (path: string) => props.files.has(path);

  // Dialog accessors ─ narrow the union for type-safe rendering.
  const d =
    <T extends DialogState["type"]>(type: T) =>
    () => {
      const s = dialog();
      return s?.type === type ? (s as Extract<DialogState, { type: T }>) : undefined;
    };
  const renameFileDialog = d("renameFile");
  const duplicateFileDialog = d("duplicateFile");
  const deleteFileDialog = d("deleteFile");
  const newFileDialog = d("newFile");
  const newFolderDialog = d("newFolder");
  const renameFolderDialog = d("renameFolder");
  const deleteFolderDialog = d("deleteFolder");
  const conflictDialog = d("conflict");

  // Folder collapse ─────────────────────────────────────────────────────────

  const toggleCollapsed = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Path moves (rename / drag-drop) ─ Y.Text instances can't be transferred
  // between Y.Map keys, so we copy content and delete the old key.
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

  // Operations ──────────────────────────────────────────────────────────────

  const handleNewFile = (dir: string, rawName: string) => {
    const path = normalizeFile(rawName, dir);
    if (!path) {
      close();
      return;
    }
    if (has(path)) {
      setDialog({ type: "conflict", proposedPath: path, sourcePath: path, flow: "newFile" });
      return;
    }
    props.files.set(path, new Y.Text());
    props.setActiveFile(path);
    close();
  };

  const handleRenameFile = (oldPath: string, rawName: string) => {
    const newPath = normalizeFile(rawName, dirOf(oldPath));
    if (!newPath || newPath === oldPath) {
      close();
      return;
    }
    if (has(newPath)) {
      setDialog({
        type: "conflict",
        proposedPath: newPath,
        sourcePath: oldPath,
        flow: "renameFile",
      });
      return;
    }
    movePath(oldPath, newPath);
    if (props.activeFile() === oldPath) props.setActiveFile(newPath);
    close();
  };

  const handleDuplicateFile = (sourcePath: string, rawName: string) => {
    const newPath = normalizeFile(rawName, dirOf(sourcePath));
    if (!newPath) {
      close();
      return;
    }
    if (has(newPath)) {
      setDialog({
        type: "conflict",
        proposedPath: newPath,
        sourcePath,
        flow: "duplicateFile",
      });
      return;
    }
    const source = props.files.get(sourcePath);
    if (!source) {
      close();
      return;
    }
    const copy = new Y.Text();
    copy.insert(0, source.toJSON());
    props.files.set(newPath, copy);
    close();
  };

  const handleDeleteFile = (path: string) => {
    if (props.files.size <= 1) {
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

  const handleNewFolder = (dir: string, rawName: string) => {
    const folder = normalizeFolder(rawName, dir);
    if (!folder) {
      close();
      return;
    }
    if (pendingFolders().has(folder) || folderHasFiles(folder) || has(folder)) {
      setDialog({
        type: "conflict",
        proposedPath: folder,
        sourcePath: folder,
        flow: "newFile",
      });
      return;
    }
    setPendingFolders((prev) => new Set([...prev, folder]));
    close();
  };

  const handleRenameFolder = (oldFolder: string, rawName: string) => {
    const leaf = rawName.trim().replace(/\/+$/, "");
    if (!leaf || leaf === leafOf(oldFolder)) {
      close();
      return;
    }
    const newFolder = joinPath(dirOf(oldFolder), leaf);
    // Conflict: any existing file or pending folder lives at the proposed path.
    if (
      pendingFolders().has(newFolder) ||
      [...props.files.keys()].some((p) => p === newFolder || p.startsWith(newFolder + "/"))
    ) {
      setDialog({
        type: "conflict",
        proposedPath: newFolder,
        sourcePath: oldFolder,
        flow: "moveFile",
      });
      return;
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
    close();
  };

  const handleDeleteFolder = (folder: string) => {
    const toDelete = [...props.files.keys()].filter(
      (p) => p === folder || p.startsWith(folder + "/")
    );
    if (toDelete.length === props.files.size) {
      // Don't allow deleting all files at once.
      close();
      return;
    }
    // Remove pending entries with this prefix (no Y.Map mutation needed).
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

  // Conflict resolution ─────────────────────────────────────────────────────

  const handleConflictOverwrite = () => {
    const c = conflictDialog();
    if (!c) return;
    if (c.flow === "renameFile") {
      props.files.delete(c.proposedPath);
      movePath(c.sourcePath, c.proposedPath);
      if (props.activeFile() === c.sourcePath) props.setActiveFile(c.proposedPath);
    }
    // Other flows: overwrite intentionally not supported.
    close();
  };

  const handleConflictPickAnother = () => {
    const c = conflictDialog();
    if (!c) return;
    switch (c.flow) {
      case "renameFile": {
        setDialog({ type: "renameFile", path: c.sourcePath });
        break;
      }
      case "duplicateFile": {
        setDialog({ type: "duplicateFile", path: c.sourcePath });
        break;
      }
      case "newFile": {
        setDialog({ type: "newFile", dir: dirOf(c.proposedPath) });
        break;
      }
      case "moveFile": {
        setDialog({ type: "renameFolder", path: c.sourcePath });
        break;
      }
    }
  };

  // Drag and drop ───────────────────────────────────────────────────────────

  const onFileDragStart = (e: DragEvent, path: string) => {
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
    if (!src) return;
    const dest = joinPath(folder, leafOf(src));
    if (dest === src) return;
    if (has(dest)) return; // refuse silent overwrite on drop
    movePath(src, dest);
    if (props.activeFile() === src) props.setActiveFile(dest);
  };
  const onRootDragOver = (e: DragEvent) => {
    if (!dragging()) return;
    e.preventDefault();
    setDragOver("");
  };
  const onRootDrop = (e: DragEvent) => {
    e.preventDefault();
    const src = e.dataTransfer?.getData("text/plain");
    setDragging(null);
    setDragOver(null);
    if (!src) return;
    const dest = `/${leafOf(src)}`;
    if (dest === src) return;
    if (has(dest)) return;
    movePath(src, dest);
    if (props.activeFile() === src) props.setActiveFile(dest);
  };

  // Render ──────────────────────────────────────────────────────────────────

  return (
    <Sidebar>
      <ContextMenu>
        <ContextMenuTrigger
          as="div"
          class={cx(
            "flex flex-1 flex-col overflow-hidden",
            dragOver() === "" && dragging() && "bg-sidebar-accent/40"
          )}
          onDragOver={onRootDragOver}
          onDragLeave={(e: DragEvent) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
              setDragOver(null);
          }}
          onDrop={onRootDrop}
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Files</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <For each={tree()}>
                    {(node) => (
                      <SidebarMenuItem style={{ "padding-left": `${String(node.depth * 12)}px` }}>
                        <ContextMenu>
                          <ContextMenuTrigger as="div">
                            <Show
                              when={node.kind === "folder" ? node : null}
                              fallback={
                                <Show when={node.kind === "file" ? node : null}>
                                  {(file) => (
                                    <SidebarMenuButton
                                      isActive={props.activeFile() === file().path}
                                      tooltip={file().path}
                                      draggable
                                      onClick={() => {
                                        props.setActiveFile(file().path);
                                      }}
                                      onDragStart={(e: DragEvent) => {
                                        onFileDragStart(e, file().path);
                                      }}
                                      onDragEnd={onDragEnd}
                                    >
                                      <TbOutlineFileText />
                                      <span>{file().name}</span>
                                    </SidebarMenuButton>
                                  )}
                                </Show>
                              }
                            >
                              {(folder) => (
                                <SidebarMenuButton
                                  tooltip={folder().path}
                                  class={cx(
                                    dragOver() === folder().path &&
                                      dragging() &&
                                      "ring-2 ring-sidebar-ring"
                                  )}
                                  onClick={() => {
                                    toggleCollapsed(folder().path);
                                  }}
                                  onDragOver={(e: DragEvent) => {
                                    onFolderDragOver(e, folder().path);
                                  }}
                                  onDragLeave={() => setDragOver(null)}
                                  onDrop={(e: DragEvent) => {
                                    onFolderDrop(e, folder().path);
                                  }}
                                >
                                  <Show
                                    when={folder().collapsed}
                                    fallback={<TbOutlineChevronDown />}
                                  >
                                    <TbOutlineChevronRight />
                                  </Show>
                                  <TbOutlineFolder />
                                  <span>{folder().name}</span>
                                </SidebarMenuButton>
                              )}
                            </Show>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <Show when={node.kind === "folder"}>
                              <ContextMenuItem
                                onSelect={() => {
                                  setDialog({ type: "newFile", dir: node.path });
                                }}
                              >
                                New file
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={() => {
                                  setDialog({ type: "newFolder", dir: node.path });
                                }}
                              >
                                New folder
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onSelect={() => {
                                  setDialog({ type: "renameFolder", path: node.path });
                                }}
                              >
                                Rename
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                class="text-destructive focus:text-destructive"
                                onSelect={() => {
                                  setDialog({ type: "deleteFolder", path: node.path });
                                }}
                              >
                                Delete
                              </ContextMenuItem>
                            </Show>
                            <Show when={node.kind === "file"}>
                              <ContextMenuItem
                                onSelect={() => {
                                  setDialog({ type: "renameFile", path: node.path });
                                }}
                              >
                                Rename
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={() => {
                                  setDialog({ type: "duplicateFile", path: node.path });
                                }}
                              >
                                Duplicate
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                class="text-destructive focus:text-destructive"
                                disabled={props.files.size <= 1}
                                onSelect={() => {
                                  setDialog({ type: "deleteFile", path: node.path });
                                }}
                              >
                                Delete
                              </ContextMenuItem>
                            </Show>
                          </ContextMenuContent>
                        </ContextMenu>
                      </SidebarMenuItem>
                    )}
                  </For>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => {
              setDialog({ type: "newFile", dir: "" });
            }}
          >
            New file
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              setDialog({ type: "newFolder", dir: "" });
            }}
          >
            New folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Dialogues ─────────────────────────────────────────────────────────── */}

      <Show when={renameFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleRenameFile(s().path, name);
            }}
            title="Rename file"
            label="File name"
            initialValue={leafOf(s().path)}
            submitLabel="Rename"
          />
        )}
      </Show>

      <Show when={duplicateFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleDuplicateFile(s().path, name);
            }}
            title="Duplicate file"
            label="New file name"
            initialValue={leafOf(s().path)}
            submitLabel="Duplicate"
          />
        )}
      </Show>

      <Show when={deleteFileDialog()}>
        {(s) => (
          <ConfirmDialog
            open
            onClose={close}
            onConfirm={() => {
              handleDeleteFile(s().path);
            }}
            title="Delete file"
            message={`Delete "${leafOf(s().path)}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
          />
        )}
      </Show>

      <Show when={newFileDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleNewFile(s().dir, name);
            }}
            title={s().dir ? `New file in ${s().dir.replace(/^\//, "")}` : "New file"}
            label="File name"
            initialValue=""
            submitLabel="Create"
          />
        )}
      </Show>

      <Show when={newFolderDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleNewFolder(s().dir, name);
            }}
            title={s().dir ? `New folder in ${s().dir.replace(/^\//, "")}` : "New folder"}
            label="Folder name"
            initialValue=""
            submitLabel="Create"
          />
        )}
      </Show>

      <Show when={renameFolderDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleRenameFolder(s().path, name);
            }}
            title="Rename folder"
            label="Folder name"
            initialValue={leafOf(s().path)}
            submitLabel="Rename"
          />
        )}
      </Show>

      <Show when={deleteFolderDialog()}>
        {(s) => (
          <ConfirmDialog
            open
            onClose={close}
            onConfirm={() => {
              handleDeleteFolder(s().path);
            }}
            title="Delete folder"
            message={`Delete "${leafOf(s().path)}" and all files inside it? This cannot be undone.`}
            confirmLabel="Delete"
            danger
          />
        )}
      </Show>

      <Show when={conflictDialog()}>
        {(s) => (
          <AlertDialog
            open
            onOpenChange={(o) => {
              if (!o) close();
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Already exists</AlertDialogTitle>
                <AlertDialogDescription>
                  "{s().proposedPath.replace(/^\//, "")}" already exists. Choose a different name
                  {s().flow === "renameFile" ? " or overwrite the existing file" : ""}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleConflictPickAnother}>Rename</AlertDialogCancel>
                <Show when={s().flow === "renameFile"}>
                  <AlertDialogAction onClick={handleConflictOverwrite}>Overwrite</AlertDialogAction>
                </Show>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Show>
    </Sidebar>
  );
}
