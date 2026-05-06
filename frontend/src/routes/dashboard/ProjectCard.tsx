import { TbOutlineDots, TbOutlinePencil, TbOutlineShare, TbOutlineTrash } from "solid-icons/tb";
import { Show } from "solid-js";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { formatDate, formatRelative } from "../../lib/format";
import type { ProjectRow, Role } from "./types";

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
    <div class="proj-card-wrap">
      <button type="button" class="proj-card" onClick={props.onOpen}>
        <div class="proj-thumb">
          <div class="proj-thumb-doc">
            <span class="proj-thumb-title">{props.project.name}</span>
          </div>
          <Show when={isShared()}>
            <Badge variant="outline" class="absolute top-2.5 right-2.5">
              {props.role}
            </Badge>
          </Show>
        </div>
        <div class="proj-meta">
          <div class="smallcaps">
            {isShared() ? "shared" : `created ${formatDate(props.project.createdAt)}`}
          </div>
          <div class="proj-title">{props.project.name}</div>
          <div class="mono proj-foot">edited {formatRelative(props.project.updatedAt)}</div>
        </div>
      </button>
      <Show when={!isShared()}>
        <div class="absolute bottom-2.5 right-2.5 z-1">
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
        </div>
      </Show>
    </div>
  );
}
