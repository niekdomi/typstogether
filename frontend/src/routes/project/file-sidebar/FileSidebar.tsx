import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineFileText,
  TbOutlineFolder,
} from "solid-icons/tb";
import { For, type JSX, Match, Show, Switch } from "solid-js";

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

  return (
    <ContextMenu>
      <ContextMenuTrigger as="div">
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
          <TbOutlineFileText />
          <span>{props.node.name}</span>
          <Show when={sb.isLocked(path())}>
            <span class="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
              entry
            </span>
          </Show>
        </SidebarMenuButton>
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

function FolderRow(props: { node: FolderNode }) {
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
            sb.onFolderDrop(e, path());
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

function Node(props: { node: FlatNode }) {
  return (
    <SidebarMenuItem style={{ "padding-left": `${String(props.node.depth * 12)}px` }}>
      <Switch>
        <Match when={props.node.kind === "file" ? props.node : null}>
          {(file) => <FileRow node={file()} />}
        </Match>
        <Match when={props.node.kind === "folder" ? props.node : null}>
          {(folder) => <FolderRow node={folder()} />}
        </Match>
      </Switch>
    </SidebarMenuItem>
  );
}

function RootDropZone(props: { children: JSX.Element }) {
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
        onDrop={sb.onRootDrop}
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
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FileSidebarBody() {
  const sb = useFileSidebarController();
  return (
    <SidebarProvider class="flex h-full flex-col">
      <RootDropZone>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={sb.tree()}>{(node) => <Node node={node} />}</For>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </RootDropZone>
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
