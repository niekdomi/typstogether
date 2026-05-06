import { TbOutlineDots, TbOutlinePencil, TbOutlineShare, TbOutlineTrash } from "solid-icons/tb";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";

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
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [wrapRef, setWrapRef] = createSignal<HTMLDivElement>();

  createEffect(() => {
    if (!menuOpen()) return;
    const handler = (e: MouseEvent) => {
      const ref = wrapRef();
      if (ref && !ref.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", handler);
    onCleanup(() => {
      document.removeEventListener("click", handler);
    });
  });

  return (
    <div class="proj-card-wrap" ref={setWrapRef}>
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
      <Show when={!isShared()}>
        <div class="proj-menu">
          <button
            type="button"
            class="kebab"
            aria-label="Project actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen());
            }}
          >
            <TbOutlineDots size={14} />
          </button>
          <Show when={menuOpen()}>
            <div class="proj-menu-list" role="menu">
              <button
                type="button"
                class="proj-menu-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  props.onShare();
                }}
              >
                <TbOutlineShare size={14} />
                Share
              </button>
              <button
                type="button"
                class="proj-menu-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  props.onRename();
                }}
              >
                <TbOutlinePencil size={14} />
                Rename
              </button>
              <button
                type="button"
                class="proj-menu-item danger"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  props.onDelete();
                }}
              >
                <TbOutlineTrash size={14} />
                Delete
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
