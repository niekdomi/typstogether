import { useColorMode } from "@kobalte/core/color-mode";
import { TbOutlineDots, TbOutlinePencil, TbOutlineShare, TbOutlineTrash } from "solid-icons/tb";
import { createEffect, createMemo, createResource, onCleanup, onMount, Show } from "solid-js";

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
import type { ProjectRow, Role } from "../../lib/projects/types";
import { generateThumbnail } from "../../lib/typst/dashboard-thumbnailer";
import { getThumbnail } from "../../lib/typst/thumbnail-cache";

interface ProjectCardProps {
  project: ProjectRow;
  role: Role;
  docUpdatedAt: Date | null;
  onOpen: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function ProjectCard(props: ProjectCardProps) {
  const { colorMode } = useColorMode();
  const isShared = () => props.role !== "owner";

  const [entry, { refetch }] = createResource(() => props.project.id, getThumbnail);
  const thumbnailUrl = createMemo(() => {
    const svg = entry()?.svg;
    if (!svg) return null;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    onCleanup(() => {
      URL.revokeObjectURL(url);
    });
    return url;
  });

  // Lazily (re)compile the preview when the card is on screen and the cached SVG
  // is missing or older than the server's content-version. Compilation is heavy,
  // so it's gated on visibility and triggered at most once per (id, version).
  const currentVersion = () => (props.docUpdatedAt ? new Date(props.docUpdatedAt).getTime() : null);
  let thumbRef: HTMLDivElement | undefined;
  let visible = false;
  let requested = "";

  const maybeGenerate = () => {
    if (!visible) return;
    const version = currentVersion();
    if (version === null) return; // no stored doc to compile
    const cached = entry();
    if (cached === undefined) return; // cache read still in flight
    if (cached?.version === version) return; // already fresh
    const id = props.project.id;
    const key = `${id}:${String(version)}`;
    if (requested === key) return;
    requested = key;
    void (async () => {
      await generateThumbnail(id, version);
      await refetch();
    })();
  };

  onMount(() => {
    if (!thumbRef) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        visible = true;
        maybeGenerate();
      }
    });
    io.observe(thumbRef);
    onCleanup(() => {
      io.disconnect();
    });
  });

  createEffect(() => {
    entry();
    currentVersion();
    maybeGenerate();
  });

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
      <div
        ref={(el) => {
          thumbRef = el;
        }}
        class="bg-muted border-border flex aspect-[1/1.1] border-b"
      >
        <div
          class="flex flex-1 items-center justify-center overflow-hidden rounded-t-xl bg-white"
          style={colorMode() === "dark" ? { filter: "invert(0.85) hue-rotate(180deg)" } : undefined}
        >
          <Show
            when={thumbnailUrl()}
            fallback={
              <span class="line-clamp-4 px-4 py-3 text-center text-[13px] leading-snug text-zinc-700">
                {props.project.name}
              </span>
            }
          >
            {(url) => (
              <img
                src={url()}
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
