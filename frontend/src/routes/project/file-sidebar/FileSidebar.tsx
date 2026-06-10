import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineEye,
  TbOutlineEyeClosed,
  TbOutlineFileText,
  TbOutlineFolder,
  TbOutlinePhoto,
} from "solid-icons/tb";
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import { cx } from "../../../components/ui/cva";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../../../components/ui/sidebar";
import { UploadButton } from "../../../components/UploadButton";
import { joinPath } from "../../../lib/paths";
import Dialogs from "./Dialogs";
import { FileSidebarProvider, useFileSidebarController } from "./FileSidebarContext";
import type { FlatNode } from "./types";

type FileNode = Extract<FlatNode, { kind: "file" }>;
type FolderNode = Extract<FlatNode, { kind: "folder" }>;

function FileRow(props: { node: FileNode }) {
  const sb = useFileSidebarController();
  const path = () => props.node.path;

  const previewing = () => sb.isPreviewing(path());
  // Eye toggle shows for the previewed file plus any .typ file eligible to be
  // previewed. The project entry (no preview active) shows neither, since
  // previewing what's already compiled is a no-op.
  const showEye = () => previewing() || sb.canPreview(path());
  const previewLabel = () => (previewing() ? "Stop previewing" : "Preview this file");

  return (
    <ContextMenu>
      <ContextMenuTrigger as="div" class="group/file relative">
        <SidebarMenuButton
          isActive={sb.activeFile() === path()}
          tooltip={path()}
          draggable={!sb.isReadOnly() && !sb.isLocked(path())}
          onClick={() => {
            sb.onSelectFile(path());
          }}
          onDragStart={(e: DragEvent) => {
            sb.onFileDragStart(e, path());
          }}
          onDragEnd={sb.onDragEnd}
        >
          <Show when={sb.isAsset(path())} fallback={<TbOutlineFileText />}>
            <TbOutlinePhoto />
          </Show>
          <span>{props.node.name}</span>
          <Show when={sb.isLocked(path())}>
            <span class="text-muted-foreground ml-auto text-[10px] tracking-wide uppercase">
              entry
            </span>
          </Show>
        </SidebarMenuButton>
        <Show when={showEye()}>
          <button
            type="button"
            title={previewLabel()}
            aria-label={previewLabel()}
            aria-pressed={previewing()}
            class={cx(
              "text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 transition-opacity",
              previewing() ? "opacity-100" : "opacity-0 group-hover/file:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              sb.togglePreview(path());
            }}
          >
            <Show when={previewing()} fallback={<TbOutlineEyeClosed size={14} />}>
              <TbOutlineEye size={14} />
            </Show>
          </button>
        </Show>
      </ContextMenuTrigger>
      <Show when={!sb.isReadOnly()}>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={sb.isLocked(path())}
            onSelect={() => {
              sb.setDialog({ type: "renameFile", path: path() });
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              sb.setDialog({ type: "duplicateFile", path: path() });
            }}
          >
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            class="text-destructive focus:text-destructive"
            disabled={!sb.canDeleteFile(path())}
            onSelect={() => {
              sb.setDialog({ type: "deleteFile", path: path() });
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </Show>
    </ContextMenu>
  );
}

// A dropped file paired with the sub-directory (relative to the drop target) it
// should land in. Top-level files carry `""`; files inside a dropped folder
// carry that folder's relative path so the structure is preserved.
interface DroppedFile {
  file: File;
  subDir: string;
}

/** Promisified `FileSystemFileEntry.file`. */
function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

/** Read a directory entry fully - `readEntries` yields at most ~100 per call. */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        next();
      }, reject);
    };
    next();
  });
}

// Recurse a dropped entry into concrete files, accumulating each one's relative
// sub-directory. Directory entries are walked rather than handed to the uploader
// (an unreadable directory "file" would hang the upload).
async function walkEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: DroppedFile[]
): Promise<void> {
  if (entry.isFile) {
    out.push({ file: await entryFile(entry as FileSystemFileEntry), subDir: prefix });
    return;
  }
  if (entry.isDirectory) {
    const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) {
      await walkEntry(child, childPrefix, out);
    }
  }
}

async function uploadOsFiles(
  e: DragEvent,
  dir: string,
  upload: (dir: string, files: File[]) => Promise<void>
): Promise<boolean> {
  const dt = e.dataTransfer;
  if (!dt) {
    return false;
  }

  // Capture entries synchronously, DataTransfer items and their entry handles
  // are only valid during the event tick, before we await anything below.
  const entries = [...dt.items].map((it) => it.webkitGetAsEntry());
  const hasEntries = entries.some(Boolean);
  const flatFiles = [...dt.files];
  if (!hasEntries && flatFiles.length === 0) {
    return false;
  }

  e.preventDefault();
  e.stopPropagation();

  const collected: DroppedFile[] = [];
  if (hasEntries) {
    // Entry API available: recurse so dropped folders bring their contents.
    for (const entry of entries) {
      if (entry) {
        await walkEntry(entry, "", collected);
      }
    }
  } else {
    // Fallback (no entry API): flat files only, folders aren't reachable here.
    collected.push(...flatFiles.map((file) => ({ file, subDir: "" })));
  }

  // Route each file to its target directory (drop dir + relative sub-path) and
  // upload per-directory so structure is preserved.
  const byDir = new Map<string, File[]>();
  for (const { file, subDir } of collected) {
    const target = subDir ? joinPath(dir, subDir) : dir;
    const group = byDir.get(target);
    if (group) {
      group.push(file);
    } else {
      byDir.set(target, [file]);
    }
  }

  await Promise.all([...byDir].map(([target, files]) => upload(target, files)));
  return true;
}

function FolderRow(props: { node: FolderNode; onUpload: (dir: string) => void }) {
  const sb = useFileSidebarController();
  const path = () => props.node.path;

  return (
    <ContextMenu>
      <ContextMenuTrigger as="div">
        <SidebarMenuButton
          tooltip={path()}
          class={cx(sb.drag.over === path() && sb.drag.source && "ring-2 ring-sidebar-ring")}
          draggable={!sb.isFolderLocked(path())}
          onClick={() => {
            sb.toggleCollapsed(path());
          }}
          onDragStart={(e: DragEvent) => {
            sb.onFolderDragStart(e, path());
          }}
          onDragEnd={sb.onDragEnd}
          onDragOver={(e: DragEvent) => {
            sb.onFolderDragOver(e, path());
          }}
          onDragLeave={sb.clearDragOver}
          onDrop={(e: DragEvent) => {
            sb.endFileDrag();
            void (async () => {
              if (await uploadOsFiles(e, path(), sb.handleUpload)) {
                return;
              }
              sb.onFolderDrop(e, path());
            })();
          }}
        >
          <Show when={props.node.collapsed} fallback={<TbOutlineChevronDown />}>
            <TbOutlineChevronRight />
          </Show>
          <TbOutlineFolder />
          <span>{props.node.name}</span>
        </SidebarMenuButton>
      </ContextMenuTrigger>
      <Show when={!sb.isReadOnly()}>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => {
              sb.setDialog({ type: "newFile", dir: path() });
            }}
          >
            New file
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              sb.setDialog({ type: "newFolder", dir: path() });
            }}
          >
            New folder
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              props.onUpload(path());
            }}
          >
            Upload files
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              sb.setDialog({ type: "renameFolder", path: path() });
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            class="text-destructive focus:text-destructive"
            onSelect={() => {
              sb.setDialog({ type: "deleteFolder", path: path() });
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </Show>
    </ContextMenu>
  );
}

function Node(props: { node: FlatNode; onUpload: (dir: string) => void }) {
  return (
    <SidebarMenuItem style={{ "padding-left": `${String(props.node.depth * 12)}px` }}>
      <Switch>
        <Match when={props.node.kind === "file" ? props.node : null}>
          {(file) => <FileRow node={file()} />}
        </Match>
        <Match when={props.node.kind === "folder" ? props.node : null}>
          {(folder) => <FolderRow node={folder()} onUpload={props.onUpload} />}
        </Match>
      </Switch>
    </SidebarMenuItem>
  );
}

function RootDropZone(props: { children: JSX.Element; onUpload: (dir: string) => void }) {
  const sb = useFileSidebarController();
  return (
    <ContextMenu>
      <ContextMenuTrigger
        as="div"
        class={cx(
          "flex flex-1 flex-col overflow-hidden",
          sb.drag.over === "" && sb.drag.source && "bg-sidebar-accent/40"
        )}
        onDragOver={sb.onRootDragOver}
        onDragLeave={sb.onRootDragLeave}
        onDrop={(e: DragEvent) => {
          sb.endFileDrag();
          void (async () => {
            if (await uploadOsFiles(e, "", sb.handleUpload)) {
              return;
            }
            sb.onRootDrop(e);
          })();
        }}
      >
        {props.children}
      </ContextMenuTrigger>
      <Show when={!sb.isReadOnly()}>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => {
              sb.setDialog({ type: "newFile", dir: "" });
            }}
          >
            New file
          </ContextMenuItem>

          <ContextMenuItem
            onSelect={() => {
              sb.setDialog({ type: "newFolder", dir: "" });
            }}
          >
            {" "}
            New folder{" "}
          </ContextMenuItem>

          <ContextMenuItem
            onSelect={() => {
              props.onUpload("");
            }}
          >
            Upload files
          </ContextMenuItem>
        </ContextMenuContent>
      </Show>
    </ContextMenu>
  );
}

function FileSidebarBody() {
  const sb = useFileSidebarController();
  const [uploadDir, setUploadDir] = createSignal("");
  let fileInput: HTMLInputElement | undefined;
  const setFileInput = (el: HTMLInputElement) => {
    fileInput = el;
  };

  const triggerUpload = (dir: string) => {
    if (!fileInput) {
      return;
    }

    setUploadDir(dir);

    fileInput.value = "";
    fileInput.click();
  };

  const onFilesPicked = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const list = target.files;
    if (!list || list.length === 0) {
      return;
    }

    await sb.handleUpload(uploadDir(), [...list]);
  };

  return (
    <SidebarProvider class="flex h-full flex-col">
      <RootDropZone onUpload={triggerUpload}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel class="flex items-center justify-between gap-1">
              <span>Files</span>
              <Show when={!sb.isReadOnly()}>
                <UploadButton
                  label="Upload files"
                  uploading={sb.uploading()}
                  active={sb.fileDragOver()}
                  onClick={() => {
                    triggerUpload("");
                  }}
                />
              </Show>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={sb.tree()}>
                  {(node) => <Node node={node} onUpload={triggerUpload} />}
                </For>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </RootDropZone>
      <input
        ref={setFileInput}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp,application/pdf,.typ,.txt,.toml,.bib,.csl,.csv,.json,.yaml,.yml,.xml,.md"
        class="hidden"
        onChange={(e) => {
          void onFilesPicked(e);
        }}
      />
      <Dialogs />
    </SidebarProvider>
  );
}

export default function FileSidebar() {
  return (
    <FileSidebarProvider>
      <FileSidebarBody />
    </FileSidebarProvider>
  );
}
