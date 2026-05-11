import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineFileText,
  TbOutlineFolder,
} from "solid-icons/tb";
import { For, Show } from "solid-js";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import { cx } from "../../../components/ui/cva";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../../components/ui/sidebar";
import Dialogs from "./Dialogs";
import type { FileSidebarProps, FlatNode } from "./types";
import { type FileSidebarController, useFileSidebar } from "./use-file-sidebar";

interface NodeProps {
  node: FlatNode;
  sb: FileSidebarController;
}

/** Right-click menu for a single tree row, branching on file vs folder. */
function NodeContextMenu(props: NodeProps) {
  return (
    <ContextMenuContent>
      <Show when={props.node.kind === "folder"}>
        <ContextMenuItem
          onSelect={() => {
            props.sb.setDialog({ type: "newFile", dir: props.node.path });
          }}
        >
          New file
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            props.sb.setDialog({ type: "newFolder", dir: props.node.path });
          }}
        >
          New folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            props.sb.setDialog({ type: "renameFolder", path: props.node.path });
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          class="text-destructive focus:text-destructive"
          onSelect={() => {
            props.sb.setDialog({ type: "deleteFolder", path: props.node.path });
          }}
        >
          Delete
        </ContextMenuItem>
      </Show>
      <Show when={props.node.kind === "file"}>
        <ContextMenuItem
          disabled={props.sb.isLocked(props.node.path)}
          onSelect={() => {
            props.sb.setDialog({ type: "renameFile", path: props.node.path });
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            props.sb.setDialog({ type: "duplicateFile", path: props.node.path });
          }}
        >
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          class="text-destructive focus:text-destructive"
          disabled={!props.sb.canDeleteFile(props.node.path)}
          onSelect={() => {
            props.sb.setDialog({ type: "deleteFile", path: props.node.path });
          }}
        >
          Delete
        </ContextMenuItem>
      </Show>
    </ContextMenuContent>
  );
}

/** A single row in the tree — either a file or a folder. */
function Node(props: NodeProps) {
  return (
    <SidebarMenuItem style={{ "padding-left": `${String(props.node.depth * 12)}px` }}>
      <ContextMenu>
        <ContextMenuTrigger as="div">
          <Show
            when={props.node.kind === "folder" ? props.node : null}
            fallback={
              <Show when={props.node.kind === "file" ? props.node : null}>
                {(file) => (
                  <SidebarMenuButton
                    isActive={props.sb.activeFile() === file().path}
                    tooltip={file().path}
                    draggable={!props.sb.isLocked(file().path)}
                    onClick={() => {
                      props.sb.onSelectFile(file().path);
                    }}
                    onDragStart={(e: DragEvent) => {
                      props.sb.onFileDragStart(e, file().path);
                    }}
                    onDragEnd={props.sb.onDragEnd}
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
                  props.sb.dragOver() === folder().path &&
                    props.sb.dragging() &&
                    "ring-2 ring-sidebar-ring"
                )}
                onClick={() => {
                  props.sb.toggleCollapsed(folder().path);
                }}
                onDragOver={(e: DragEvent) => {
                  props.sb.onFolderDragOver(e, folder().path);
                }}
                onDragLeave={props.sb.clearDragOver}
                onDrop={(e: DragEvent) => {
                  props.sb.onFolderDrop(e, folder().path);
                }}
              >
                <Show when={folder().collapsed} fallback={<TbOutlineChevronDown />}>
                  <TbOutlineChevronRight />
                </Show>
                <TbOutlineFolder />
                <span>{folder().name}</span>
              </SidebarMenuButton>
            )}
          </Show>
        </ContextMenuTrigger>
        <NodeContextMenu node={props.node} sb={props.sb} />
      </ContextMenu>
    </SidebarMenuItem>
  );
}

export default function FileSidebar(props: FileSidebarProps) {
  const sb = useFileSidebar(props);

  return (
    <Sidebar>
      <ContextMenu>
        <ContextMenuTrigger
          as="div"
          class={cx(
            "flex flex-1 flex-col overflow-hidden",
            sb.dragOver() === "" && sb.dragging() && "bg-sidebar-accent/40"
          )}
          onDragOver={sb.onRootDragOver}
          onDragLeave={sb.onRootDragLeave}
          onDrop={sb.onRootDrop}
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Files</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <For each={sb.tree()}>{(node) => <Node node={node} sb={sb} />}</For>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
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

      <Dialogs sb={sb} />
    </Sidebar>
  );
}
