import { TbOutlineDots, TbOutlinePencil, TbOutlineShare, TbOutlineTrash } from "solid-icons/tb";
import { Show } from "solid-js";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { formatDate, formatRelative } from "../../lib/format";
import type { ProjectRow, Role } from "../../lib/use-projects";

interface ProjectCardProps {
  project: ProjectRow;
  role: Role;
  onOpen: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function ProjectCard(props: ProjectCardProps) {
  const isShared = () => props.role !== "owner";

  return (
    <Card
      role="button"
      tabIndex={0}
      class="cursor-pointer overflow-hidden gap-0 py-0 transition-colors hover:border-foreground"
      onClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onOpen();
        }
      }}
    >
      <div class="aspect-[1/1.1] bg-muted border-b border-border p-5 flex">
        <div class="flex-1 flex items-center justify-center bg-card border border-border/60 px-4 py-3 overflow-hidden">
          <span class="text-center text-[13px] leading-snug text-foreground/75 line-clamp-4">
            {props.project.name}
          </span>
        </div>
      </div>
      <div class="px-5 py-4 flex items-start gap-3">
        <div class="flex-1 min-w-0 flex flex-col gap-1.5">
          <div class="text-xs text-muted-foreground">
            {isShared() ? "shared" : `created ${formatDate(props.project.createdAt)}`}
          </div>
          <div class="font-medium text-[15px] leading-tight truncate text-foreground">
            {props.project.name}
          </div>
          <div class="font-mono text-[11px] text-muted-foreground">
            last edited {formatRelative(props.project.updatedAt)}
          </div>
        </div>
        <div
          class="shrink-0 -mr-2"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Show
            when={isShared()}
            fallback={
              <DropdownMenu>
                <DropdownMenuTrigger
                  as={Button<"button">}
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Project actions"
                >
                  <TbOutlineDots size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent class="min-w-36">
                  <DropdownMenuItem onSelect={props.onShare}>
                    <TbOutlineShare size={14} />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={props.onRename}>
                    <TbOutlinePencil size={14} />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={props.onDelete}>
                    <TbOutlineTrash size={14} />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          >
            <Badge variant="outline">{props.role}</Badge>
          </Show>
        </div>
      </div>
    </Card>
  );
}
