import { useColorMode } from "@kobalte/core/color-mode";
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
import { blobUrl } from "../../lib/assets/upload";
import { formatDate, formatRelative } from "../../lib/format";
import type { ProjectRow, Role } from "../../lib/projects/types";

interface ProjectCardProps {
  project: ProjectRow;
  role: Role;
  onOpen: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function ProjectCard(props: ProjectCardProps) {
  const { colorMode } = useColorMode();
  const isShared = () => props.role !== "owner";

  return (
    <Card
      role="button"
      tabIndex={0}
      class="hover:border-foreground cursor-pointer gap-0 overflow-hidden py-0 transition-colors"
      onClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onOpen();
        }
      }}
    >
      <div class="bg-muted border-border flex aspect-[1/1.1] border-b">
        <div
          class="flex flex-1 items-center justify-center overflow-hidden rounded-t-xl bg-white"
          style={colorMode() === "dark" ? { filter: "invert(0.85) hue-rotate(180deg)" } : undefined}
        >
          <Show
            when={props.project.thumbnailBlobId}
            fallback={
              <span class="line-clamp-4 px-4 py-3 text-center text-[13px] leading-snug text-zinc-700">
                {props.project.name}
              </span>
            }
          >
            {(blobId) => (
              <img
                src={blobUrl(props.project.id, blobId())}
                alt={props.project.name}
                loading="lazy"
                decoding="async"
                class="h-full w-full object-contain"
              />
            )}
          </Show>
        </div>
      </div>
      <div class="flex items-start gap-3 px-5 py-4">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <div class="text-muted-foreground text-xs">
            {isShared() ? "shared" : `created ${formatDate(props.project.createdAt)}`}
          </div>
          <div class="text-foreground truncate text-[15px] leading-tight font-medium">
            {props.project.name}
          </div>
          <div class="text-muted-foreground font-mono text-[11px]">
            last edited {formatRelative(props.project.updatedAt)}
          </div>
        </div>
        <div
          class="-mr-2 shrink-0"
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
