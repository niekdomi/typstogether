import { TbOutlineFileText, TbOutlineFolder } from "solid-icons/tb";
import { createSignal, For, Show } from "solid-js";

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
import ConfirmDialog from "../dashboard/ConfirmDialog";
import PromptDialog from "../dashboard/PromptDialog";

interface FileEntry {
  name: string;
  type: "file" | "folder";
  parent?: string; // folder name; undefined = root
}

type ConflictFlow = "rename" | "duplicate" | "newFile" | "newFileInFolder";

type DialogState =
  | { type: "rename"; filename: string }
  | { type: "delete"; filename: string }
  | { type: "duplicate"; filename: string }
  | {
      type: "conflict";
      proposedName: string;
      sourceName: string;
      flow: ConflictFlow;
      folderName?: string;
    }
  | { type: "newFile" }
  | { type: "newFolder" }
  | { type: "newFileInFolder"; folderName: string };

interface Props {
  activeFile: () => string;
  setActiveFile: (f: string) => void;
}

export default function FileSidebar(props: Props) {
  const [entries, setEntries] = createSignal<FileEntry[]>([{ name: "main.typ", type: "file" }]);
  const [dialog, setDialog] = createSignal<DialogState | null>(null);
  const [dragging, setDragging] = createSignal<string | null>(null);
  const [dragOver, setDragOver] = createSignal<string | null>(null); // folder name | "root" | null

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Closes the active dialog. */
  const close = () => setDialog(null);

  /** Returns true if an entry with the given name already exists. */
  const hasEntry = (name: string) => entries().some((e) => e.name === name);

  /**
   * Flattens the two-level tree into a single ordered list: each root entry is
   * immediately followed by its children, allowing the JSX to use one `<For>`
   * with depth-based indentation instead of nested loops.
   */
  const flatEntries = () => {
    const result: (FileEntry & { depth: number })[] = [];

    for (const e of entries()) {
      if (e.parent) {
        continue;
      }

      result.push({ ...e, depth: 0 });
      if (e.type === "folder") {
        for (const child of entries().filter((c) => c.parent === e.name)) {
          result.push({ ...child, depth: 1 });
        }
      }
    }

    return result;
  };

  // ── Dialog Accessors ───────────────────────────────────────────────────────

  /**
   * Returns a typed signal accessor for the current dialog, narrowed to the
   * given type variant. Returning `undefined` when the type doesn't match lets
   * `<Show>` skip rendering and provides a non-null value inside its children.
   */
  const d =
    <T extends DialogState["type"]>(type: T) =>
    () => {
      const s = dialog();
      return s?.type === type ? (s as Extract<DialogState, { type: T }>) : undefined;
    };
  const renameDialog = d("rename");
  const duplicateDialog = d("duplicate");
  const deleteDialog = d("delete");
  const conflictDialog = d("conflict");
  const newFileDialog = d("newFile");
  const newFolderDialog = d("newFolder");
  const newFileInFolderDialog = d("newFileInFolder");

  // ── File Operation Handlers ────────────────────────────────────────────────

  /** Renames an entry; opens the conflict dialog if the target name is already taken. */
  const handleRename = (oldName: string, newName: string): void => {
    if (newName === oldName) {
      close();
      return;
    }

    if (hasEntry(newName)) {
      setDialog({ type: "conflict", proposedName: newName, sourceName: oldName, flow: "rename" });
      return;
    }

    setEntries((prev) => prev.map((e) => (e.name === oldName ? { ...e, name: newName } : e)));

    if (props.activeFile() === oldName) {
      props.setActiveFile(newName);
    }

    close();
  };

  /** Duplicates a file; opens the conflict dialog if the new name is already taken. */
  const handleDuplicate = (sourceName: string, newName: string): void => {
    if (hasEntry(newName)) {
      setDialog({ type: "conflict", proposedName: newName, sourceName, flow: "duplicate" });
      return;
    }

    const source = entries().find((e) => e.name === sourceName);

    if (source) {
      setEntries((prev) => [...prev, { ...source, name: newName }]);
    }

    close();
  };

  /**
   * Deletes an entry and all its children. If the deleted entry was the active
   * file, switches focus to the next available file.
   */
  const handleDelete = (filename: string) => {
    setEntries((prev) => prev.filter((e) => e.name !== filename && e.parent !== filename));

    if (props.activeFile() === filename) {
      const next = entries().find((e) => e.name !== filename && e.type === "file");
      props.setActiveFile(next?.name ?? "");
    }

    close();
  };

  /** Creates a new root file; opens the conflict dialog if the name is already taken. */
  const handleNewFile = (name: string): void => {
    if (hasEntry(name)) {
      setDialog({ type: "conflict", proposedName: name, sourceName: name, flow: "newFile" });
      return;
    }

    setEntries((prev) => [...prev, { name, type: "file" }]);
    props.setActiveFile(name);

    close();
  };

  /** Creates a new file inside a folder; opens the conflict dialog if the name is already taken. */
  const handleNewFileInFolder = (folderName: string, name: string): void => {
    if (hasEntry(name)) {
      setDialog({
        type: "conflict",
        proposedName: name,
        sourceName: name,
        flow: "newFileInFolder",
        folderName,
      });
      return;
    }

    setEntries((prev) => [...prev, { name, type: "file", parent: folderName }]);
    props.setActiveFile(name);

    close();
  };

  /** Creates a new folder, silently ignoring the action if the name is already taken. */
  const handleNewFolder = (name: string) => {
    if (!hasEntry(name)) {
      setEntries((prev) => [...prev, { name, type: "folder" }]);
    }

    close();
  };

  // ── Conflict Resolution ────────────────────────────────────────────────────

  /**
   * Overwrites the existing file by deleting it and completing the original
   * operation. Only the rename flow is currently implemented; other flows
   * just close the dialog.
   */
  const handleConflictOverwrite = () => {
    const c = conflictDialog();
    if (!c) {
      return;
    }

    if (c.flow === "rename") {
      setEntries((prev) =>
        prev
          .filter((e) => e.name !== c.proposedName)
          .map((e) => (e.name === c.sourceName ? { ...e, name: c.proposedName } : e))
      );

      if (props.activeFile() === c.sourceName) {
        props.setActiveFile(c.proposedName);
      }
    }

    close();
  };

  /** Returns to the originating dialog so the user can choose a different name. */
  const handleConflictRename = () => {
    const c = conflictDialog();
    if (!c) {
      return;
    }

    switch (c.flow) {
      case "rename": {
        setDialog({ type: "rename", filename: c.sourceName });
        break;
      }
      case "duplicate": {
        setDialog({ type: "duplicate", filename: c.sourceName });
        break;
      }
      case "newFileInFolder": {
        if (c.folderName) {
          setDialog({ type: "newFileInFolder", folderName: c.folderName });
        }
        break;
      }
      default: {
        setDialog({ type: "newFile" });
      }
    }
  };

  // ── Drag and Drop ──────────────────────────────────────────────────────────
  // Only files are draggable; folders act as drop targets.

  /** Stores the dragged filename in the transfer payload and marks it as active. */
  const onFileDragStart = (e: DragEvent, name: string) => {
    e.dataTransfer?.setData("text/plain", name);
    e.stopPropagation();
    setDragging(name);
  };

  /** Clears all drag state when a drag operation ends or is cancelled. */
  const onDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  /** Highlights a folder as a drop target while a file is dragged over it. */
  const onFolderDragOver = (e: DragEvent, folderName: string) => {
    if (!dragging()) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(folderName);
  };

  /** Moves the dragged file into the folder on drop. */
  const onFolderDrop = (e: DragEvent, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();

    const name = e.dataTransfer?.getData("text/plain");
    if (name) {
      setEntries((prev) =>
        prev.map((en) => (en.name === name ? { ...en, parent: folderName } : en))
      );
    }

    setDragging(null);
    setDragOver(null);
  };

  /** Highlights the root zone when a file is dragged over the sidebar background. */
  const onRootDragOver = (e: DragEvent) => {
    if (!dragging()) return;
    e.preventDefault();
    setDragOver("root");
  };

  /** Moves the dragged file back to the root level (removes its parent) on drop. */
  const onRootDrop = (e: DragEvent) => {
    e.preventDefault();
    const name = e.dataTransfer?.getData("text/plain");

    if (name) {
      setEntries((prev) =>
        prev.map((en) => (en.name === name ? { ...en, parent: undefined } : en))
      );
    }

    setDragging(null);
    setDragOver(null);
  };

  return (
    <Sidebar>
      <ContextMenu>
        <ContextMenuTrigger
          as="div"
          class={cx(
            "flex flex-1 flex-col overflow-hidden",
            dragOver() === "root" && dragging() && "bg-sidebar-accent/40"
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
                  <For each={flatEntries()}>
                    {(entry) => (
                      <SidebarMenuItem class={cx(entry.depth === 1 && "pl-3")}>
                        <ContextMenu>
                          <ContextMenuTrigger as="div">
                            <SidebarMenuButton
                              isActive={entry.type === "file" && props.activeFile() === entry.name}
                              tooltip={entry.name}
                              draggable={entry.type === "file"}
                              class={cx(
                                entry.type === "folder" &&
                                  dragOver() === entry.name &&
                                  "ring-2 ring-sidebar-ring"
                              )}
                              onClick={() => {
                                if (entry.type === "file") props.setActiveFile(entry.name);
                              }}
                              onDragStart={(e: DragEvent) => {
                                if (entry.type === "file") onFileDragStart(e, entry.name);
                              }}
                              onDragEnd={onDragEnd}
                              onDragOver={(e: DragEvent) => {
                                if (entry.type === "folder") onFolderDragOver(e, entry.name);
                              }}
                              onDragLeave={() => setDragOver(null)}
                              onDrop={(e: DragEvent) => {
                                if (entry.type === "folder") onFolderDrop(e, entry.name);
                              }}
                            >
                              {entry.type === "folder" ? (
                                <TbOutlineFolder />
                              ) : (
                                <TbOutlineFileText />
                              )}
                              <span>{entry.name}</span>
                            </SidebarMenuButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            {entry.type === "folder" && (
                              <>
                                <ContextMenuItem
                                  onSelect={() =>
                                    setDialog({
                                      type: "newFileInFolder",
                                      folderName: entry.name,
                                    })
                                  }
                                >
                                  New file
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                              </>
                            )}
                            <ContextMenuItem
                              onSelect={() => setDialog({ type: "rename", filename: entry.name })}
                            >
                              Rename
                            </ContextMenuItem>
                            {entry.type === "file" && (
                              <ContextMenuItem
                                onSelect={() =>
                                  setDialog({ type: "duplicate", filename: entry.name })
                                }
                              >
                                Duplicate
                              </ContextMenuItem>
                            )}
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              class="text-destructive focus:text-destructive"
                              onSelect={() => setDialog({ type: "delete", filename: entry.name })}
                            >
                              Delete
                            </ContextMenuItem>
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
          <ContextMenuItem onSelect={() => setDialog({ type: "newFile" })}>
            New file
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setDialog({ type: "newFolder" })}>
            New folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Show when={renameDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleRename(s().filename, name);
            }}
            title="Rename"
            label="File name"
            initialValue={s().filename}
            submitLabel="Rename"
          />
        )}
      </Show>

      <Show when={duplicateDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleDuplicate(s().filename, name);
            }}
            title="Duplicate file"
            label="New file name"
            initialValue={s().filename}
            submitLabel="Duplicate"
          />
        )}
      </Show>

      <Show when={deleteDialog()}>
        {(s) => (
          <ConfirmDialog
            open
            onClose={close}
            onConfirm={() => {
              handleDelete(s().filename);
            }}
            title="Delete"
            message={`Are you sure you want to delete "${s().filename}"? This cannot be undone.`}
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
                <AlertDialogTitle>File already exists</AlertDialogTitle>
                <AlertDialogDescription>
                  "{s().proposedName}" already exists. Choose a different name or overwrite the
                  existing file.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleConflictRename}>Rename</AlertDialogCancel>
                <AlertDialogAction onClick={handleConflictOverwrite}>Overwrite</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Show>

      <Show when={newFileDialog()}>
        <PromptDialog
          open
          onClose={close}
          onSubmit={(name) => {
            handleNewFile(name);
          }}
          title="New file"
          label="File name"
          initialValue=""
          submitLabel="Create"
        />
      </Show>

      <Show when={newFolderDialog()}>
        <PromptDialog
          open
          onClose={close}
          onSubmit={(name) => {
            handleNewFolder(name);
          }}
          title="New folder"
          label="Folder name"
          initialValue=""
          submitLabel="Create"
        />
      </Show>

      <Show when={newFileInFolderDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleNewFileInFolder(s().folderName, name);
            }}
            title={`New file in ${s().folderName}`}
            label="File name"
            initialValue=""
            submitLabel="Create"
          />
        )}
      </Show>
    </Sidebar>
  );
}
