import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineEye,
  TbOutlineEyeClosed,
  TbOutlineFileText,
  TbOutlineFolder,
  TbOutlinePhoto,
  TbOutlineUpload,
} from "solid-icons/tb";
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";

import { Button } from "../../../components/ui/button";
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
import Dialogs from "./Dialogs";
import { FileSidebarProvider, useFileSidebarController } from "./FileSidebarContext";
import type { FlatNode } from "./types";

type FileNode = Extract<FlatNode, { kind: "file" }>;
type FolderNode = Extract<FlatNode, { kind: "folder" }>;

function FileRow(props: { node: FileNode }) {
  const sb = useFileSidebarController();
  const path = () => props.node.path;

  // Eye toggle shows for .typ files that can be previewed or are currently
  // previewed. The current effective entry (no preview active) shows neither
  // an eye nor an option, since previewing what's already compiled is a no-op.
  const showEye = () => sb.isPreviewing(path()) || sb.canPreview(path());

  return (
    <ContextMenu>
      <ContextMenuTrigger as="div" class="group/file relative">
        <SidebarMenuButton
          isActive={sb.activeFile() === path()}
          tooltip={path()}
          draggable={!sb.isLocked(path())}
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
            title={sb.isPreviewing(path()) ? "Stop previewing" : "Preview this file"}
            aria-label={sb.isPreviewing(path()) ? "Stop previewing" : "Preview this file"}
            aria-pressed={sb.isPreviewing(path())}
            class={cx(
              "text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 transition-opacity",
              sb.isPreviewing(path()) ? "opacity-100" : "opacity-0 group-hover/file:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              sb.togglePreview(path());
            }}
          >
            <Show when={sb.isPreviewing(path())} fallback={<TbOutlineEyeClosed size={14} />}>
              <TbOutlineEye size={14} />
            </Show>
          </button>
        </Show>
      </ContextMenuTrigger>
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
    </ContextMenu>
  );
}

async function uploadOsFiles(
  e: DragEvent,
  dir: string,
  upload: (dir: string, file: File) => Promise<string | undefined>
): Promise<boolean> {
  const list = e.dataTransfer?.files;
  if (!list || list.length === 0) return false;
  e.preventDefault();
  e.stopPropagation();
  for (const file of list) {
    await upload(dir, file);
  }
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
          onClick={() => {
            sb.toggleCollapsed(path());
          }}
          onDragOver={(e: DragEvent) => {
            sb.onFolderDragOver(e, path());
          }}
          onDragLeave={sb.clearDragOver}
          onDrop={(e: DragEvent) => {
            void (async () => {
              if (await uploadOsFiles(e, path(), sb.handleUploadAsset)) return;
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
          Upload asset
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
          void (async () => {
            if (await uploadOsFiles(e, "", sb.handleUploadAsset)) return;
            sb.onRootDrop(e);
          })();
        }}
      >
        {props.children}
      </ContextMenuTrigger>
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
          New folder
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            props.onUpload("");
          }}
        >
          Upload asset
        </ContextMenuItem>
      </ContextMenuContent>
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
    if (!fileInput) return;
    setUploadDir(dir);
    fileInput.value = "";
    fileInput.click();
  };

  const onFilesPicked = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const list = target.files;
    if (!list || list.length === 0) return;
    const dir = uploadDir();
    for (const file of list) {
      await sb.handleUploadAsset(dir, file);
    }
  };

  return (
    <SidebarProvider class="flex h-full flex-col">
      <RootDropZone onUpload={triggerUpload}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel class="flex items-center justify-between gap-1">
              <span>Files</span>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Upload asset"
                aria-label="Upload asset"
                onClick={() => {
                  triggerUpload("");
                }}
              >
                <TbOutlineUpload />
              </Button>
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
        accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp,application/pdf"
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
