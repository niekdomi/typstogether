import { Show } from "solid-js";

import { formatDate, formatRelative } from "../../lib/format";
import type { ProjectRow, Role } from "./types";

interface ProjectCardProps {
  project: ProjectRow;
  role: Role;
  onOpen: () => void;
}

export default function ProjectCard(props: ProjectCardProps) {
  const isShared = () => props.role !== "owner";
  return (
    <button type="button" class="proj-card" onClick={props.onOpen}>
      <div class="proj-thumb">
        <div class="proj-thumb-doc">
          <span class="proj-thumb-title">{props.project.name}</span>
        </div>
        <Show when={isShared()}>
          <span class="role">{props.role}</span>
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
  );
}
