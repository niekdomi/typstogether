import { TbOutlineFileText, TbOutlineFolder } from "solid-icons/tb";
import { createSignal, For, Show } from "solid-js";

import ConfirmDialog from "../../components/ConfirmDialog";
import PromptDialog from "../../components/PromptDialog";
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

interface FileEntry {
  name: string;
  type: "file" | "folder";
}

type DialogState =
  | { type: "rename"; filename: string }
  | { type: "delete"; filename: string }
  | { type: "duplicate"; filename: string }
  | {
      type: "conflict";
      proposedName: string;
      sourceName: string;
      flow: "rename" | "duplicate" | "newFile";
    }
  | { type: "newFile" }
  | { type: "newFolder" };

export default function FileSidebar() {
  const [entries, setEntries] = createSignal<FileEntry[]>([{ name: "main.typ", type: "file" }]);
  const [activeFile, setActiveFile] = createSignal("main.typ");
  const [dialog, setDialog] = createSignal<DialogState | null>(null);

  const close = () => setDialog(null);
  const hasEntry = (name: string) => entries().some((e) => e.name === name);

  // typed dialog accessors for Show
  const d =
    <T extends DialogState["type"]>(type: T) =>
    () => {
      const s = dialog();
      return s?.type === type ? (s as Extract<DialogState, { type: T }>) : undefined;
    };
  const renameD = d("rename");
  const duplicateD = d("duplicate");
  const deleteD = d("delete");
  const conflictD = d("conflict");
  const newFileD = d("newFile");
  const newFolderD = d("newFolder");

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
    if (activeFile() === oldName) setActiveFile(newName);
    close();
  };

  const handleDuplicate = (sourceName: string, newName: string): void => {
    if (hasEntry(newName)) {
      setDialog({ type: "conflict", proposedName: newName, sourceName, flow: "duplicate" });
      return;
    }
    const source = entries().find((e) => e.name === sourceName);
    if (source) setEntries((prev) => [...prev, { ...source, name: newName }]);
    close();
  };

  const handleDelete = (filename: string) => {
    setEntries((prev) => prev.filter((e) => e.name !== filename));
    if (activeFile() === filename) {
      const next = entries().find((e) => e.name !== filename && e.type === "file");
      setActiveFile(next?.name ?? "");
    }
    close();
  };

  const handleNewFile = (name: string): void => {
    if (hasEntry(name)) {
      setDialog({ type: "conflict", proposedName: name, sourceName: name, flow: "newFile" });
      return;
    }
    setEntries((prev) => [...prev, { name, type: "file" }]);
    setActiveFile(name);
    close();
  };

  const handleNewFolder = (name: string) => {
    if (!hasEntry(name)) setEntries((prev) => [...prev, { name, type: "folder" }]);
    close();
  };

  const handleConflictOverwrite = () => {
    const c = conflictD();
    if (!c) return;
    if (c.flow === "rename") {
      setEntries((prev) =>
        prev
          .filter((e) => e.name !== c.proposedName)
          .map((e) => (e.name === c.sourceName ? { ...e, name: c.proposedName } : e))
      );
      if (activeFile() === c.sourceName) setActiveFile(c.proposedName);
    }
    close();
  };

  const handleConflictRename = () => {
    const c = conflictD();
    if (!c) return;
    if (c.flow === "rename") setDialog({ type: "rename", filename: c.sourceName });
    else if (c.flow === "duplicate") setDialog({ type: "duplicate", filename: c.sourceName });
    else setDialog({ type: "newFile" });
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
                  <For each={entries()}>
                    {(entry) => (
                      <SidebarMenuItem>
                        <ContextMenu>
                          <ContextMenuTrigger as="div">
                            <SidebarMenuButton
                              isActive={entry.type === "file" && activeFile() === entry.name}
                              onClick={() => {
                                if (entry.type === "file") setActiveFile(entry.name);
                              }}
                              tooltip={entry.name}
                            >
                              <Show when={entry.type === "folder"} fallback={<TbOutlineFileText />}>
                                <TbOutlineFolder />
                              </Show>
                              <span>{entry.name}</span>
                            </SidebarMenuButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={() => setDialog({ type: "rename", filename: entry.name })}
                            >
                              Rename
                            </ContextMenuItem>
                            <Show when={entry.type === "file"}>
                              <ContextMenuItem
                                onSelect={() =>
                                  setDialog({ type: "duplicate", filename: entry.name })
                                }
                              >
                                Duplicate
                              </ContextMenuItem>
                            </Show>
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

      <Show when={renameD()}>
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

      <Show when={duplicateD()}>
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

      <Show when={deleteD()}>
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

      <Show when={conflictD()}>
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

      <Show when={newFileD()}>
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

      <Show when={newFolderD()}>
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
    </Sidebar>
  );
}
