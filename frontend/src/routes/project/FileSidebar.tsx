import { TbOutlineFileText } from "solid-icons/tb";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
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

type ConflictFlow = "rename" | "duplicate" | "newFile";

type DialogState =
  | { type: "rename"; path: string }
  | { type: "duplicate"; path: string }
  | { type: "delete"; path: string }
  | { type: "newFile" }
  | { type: "conflict"; proposedPath: string; sourcePath: string; flow: ConflictFlow };

interface Props {
  files: Y.Map<Y.Text>;
  activeFile: () => string;
  setActiveFile: (path: string) => void;
}

/** Normalize a user-entered name into a Typst VFS path. */
function normalizePath(input: string): string {
  let path = input.trim();
  if (!path) return "";
  if (!path.endsWith(".typ")) path += ".typ";
  if (!path.startsWith("/")) path = "/" + path;
  return path;
}

/** Strip the leading slash for display. */
function display(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

export default function FileSidebar(props: Props) {
  const [paths, setPaths] = createSignal<string[]>([]);
  const [dialog, setDialog] = createSignal<DialogState | null>(null);

  // Mirror Y.Map keys into a sorted Solid signal so the list re-renders on
  // any mutation (local or remote).
  createEffect(() => {
    const map = props.files;
    const refresh = () => setPaths([...map.keys()].toSorted());
    refresh();
    map.observe(refresh);
    onCleanup(() => {
      map.unobserve(refresh);
    });
  });

  const close = () => setDialog(null);

  const has = (path: string) => props.files.has(path);

  const renameDialog = () => {
    const s = dialog();
    return s?.type === "rename" ? s : undefined;
  };
  const duplicateDialog = () => {
    const s = dialog();
    return s?.type === "duplicate" ? s : undefined;
  };
  const deleteDialog = () => {
    const s = dialog();
    return s?.type === "delete" ? s : undefined;
  };
  const newFileDialog = () => {
    const s = dialog();
    return s?.type === "newFile" ? s : undefined;
  };
  const conflictDialog = () => {
    const s = dialog();
    return s?.type === "conflict" ? s : undefined;
  };

  const handleNewFile = (rawName: string) => {
    const path = normalizePath(rawName);
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

  const handleRename = (oldPath: string, rawName: string) => {
    const newPath = normalizePath(rawName);
    if (!newPath || newPath === oldPath) {
      close();
      return;
    }
    if (has(newPath)) {
      setDialog({
        type: "conflict",
        proposedPath: newPath,
        sourcePath: oldPath,
        flow: "rename",
      });
      return;
    }
    const oldText = props.files.get(oldPath);
    if (!oldText) {
      close();
      return;
    }
    // Y.Text instances can't be moved between Y.Map keys — copy content.
    const newText = new Y.Text();
    newText.insert(0, oldText.toJSON());
    props.files.doc?.transact(() => {
      props.files.set(newPath, newText);
      props.files.delete(oldPath);
    });
    if (props.activeFile() === oldPath) props.setActiveFile(newPath);
    close();
  };

  const handleDuplicate = (sourcePath: string, rawName: string) => {
    const newPath = normalizePath(rawName);
    if (!newPath) {
      close();
      return;
    }
    if (has(newPath)) {
      setDialog({
        type: "conflict",
        proposedPath: newPath,
        sourcePath,
        flow: "duplicate",
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

  const handleDelete = (path: string) => {
    if (props.files.size <= 1) {
      close();
      return;
    }
    props.files.delete(path);
    close();
  };

  const handleConflictOverwrite = () => {
    const c = conflictDialog();
    if (!c) return;
    if (c.flow === "rename") {
      const oldText = props.files.get(c.sourcePath);
      if (!oldText) {
        close();
        return;
      }
      const newText = new Y.Text();
      newText.insert(0, oldText.toJSON());
      props.files.doc?.transact(() => {
        props.files.set(c.proposedPath, newText);
        props.files.delete(c.sourcePath);
      });
      if (props.activeFile() === c.sourcePath) props.setActiveFile(c.proposedPath);
    }
    // For duplicate / newFile, overwrite is intentionally a no-op for now.
    close();
  };

  const handleConflictRename = () => {
    const c = conflictDialog();
    if (!c) return;
    switch (c.flow) {
      case "rename": {
        setDialog({ type: "rename", path: c.sourcePath });
        break;
      }
      case "duplicate": {
        setDialog({ type: "duplicate", path: c.sourcePath });
        break;
      }
      case "newFile": {
        setDialog({ type: "newFile" });
        break;
      }
    }
  };

  return (
    <Sidebar>
      <ContextMenu>
        <ContextMenuTrigger as="div" class="flex flex-1 flex-col overflow-hidden">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Files</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <For each={paths()}>
                    {(path) => (
                      <SidebarMenuItem>
                        <ContextMenu>
                          <ContextMenuTrigger as="div">
                            <SidebarMenuButton
                              isActive={props.activeFile() === path}
                              tooltip={path}
                              onClick={() => {
                                props.setActiveFile(path);
                              }}
                            >
                              <TbOutlineFileText />
                              <span>{display(path)}</span>
                            </SidebarMenuButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onSelect={() => setDialog({ type: "rename", path })}>
                              Rename
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => setDialog({ type: "duplicate", path })}
                            >
                              Duplicate
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              class="text-destructive focus:text-destructive"
                              disabled={props.files.size <= 1}
                              onSelect={() => setDialog({ type: "delete", path })}
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
        </ContextMenuContent>
      </ContextMenu>

      <Show when={renameDialog()}>
        {(s) => (
          <PromptDialog
            open
            onClose={close}
            onSubmit={(name) => {
              handleRename(s().path, name);
            }}
            title="Rename file"
            label="File name"
            initialValue={display(s().path)}
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
              handleDuplicate(s().path, name);
            }}
            title="Duplicate file"
            label="New file name"
            initialValue={display(s().path)}
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
              handleDelete(s().path);
            }}
            title="Delete file"
            message={`Delete "${display(s().path)}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
          />
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
                  "{display(s().proposedPath)}" already exists. Choose a different name
                  {s().flow === "rename" ? " or overwrite the existing file" : ""}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleConflictRename}>Rename</AlertDialogCancel>
                <Show when={s().flow === "rename"}>
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
