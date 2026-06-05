import {
  TbOutlineChevronDown,
  TbOutlineChevronRight,
  TbOutlineCopy,
  TbOutlineTrash,
} from "solid-icons/tb";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { toast } from "somoto";

import { SidebarGroupLabel } from "../../components/ui/sidebar";
import { UploadButton } from "../../components/UploadButton";
import { uploadFont } from "../../lib/fonts/upload";
import { useProjectContext } from "./ProjectContext";

const FONT_ACCEPT = ".ttf,.otf,.ttc";

const copyFamily = (family: string) => {
  void navigator.clipboard.writeText(family);
  toast(`Copied "${family}"`);
};

// Manage the project's custom fonts (the `fonts` Y.Map, filename -> blob_id).
// Upload registers each font with every collaborator's compiler via useFontsSync;
// removal applies on reload since the engine has no live unregister.
export default function FontsPanel() {
  const ctx = useProjectContext();
  const [entries, setEntries] = createSignal<[string, string][]>([]);
  const [pending, setPending] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  // Families the user has expanded to reveal their individual weight files.
  const [expanded, setExpanded] = createSignal(new Set<string>());

  // The Y.Map isn't reactive; mirror its entries (filename -> blob_id) sorted.
  // The family name shown per row comes from ctx.fontFamilies, parsed once by
  // useFontsSync from the bytes it already fetched.
  createEffect(() => {
    const map = ctx.collab.fonts;
    if (!map) {
      setEntries([]);
      return;
    }
    const refresh = () =>
      setEntries([...map.entries()].toSorted((a, b) => a[0].localeCompare(b[0])));
    refresh();
    map.observe(refresh);
    onCleanup(() => {
      map.unobserve(refresh);
    });
  });

  // Group files under their family (e.g. all Roboto weights under "Roboto")
  // Fonts whose family hasn't resolved yet fall back to grouping under their filename.
  const groups = createMemo<[string, [string, string][]][]>(() => {
    const byFamily = new Map<string, [string, string][]>();
    for (const [filename, blobId] of entries()) {
      const key = ctx.fontFamilies[blobId] ?? filename;
      const members = byFamily.get(key) ?? [];
      members.push([filename, blobId]);
      byFamily.set(key, members);
    }
    return [...byFamily.entries()].toSorted((a, b) => a[0].localeCompare(b[0]));
  });

  const toggle = (name: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  // Upload all selected files in parallel; a font family is usually several
  // static files (one per weight/style), so multi-select avoids a file-at-a-time
  // slog. Each success writes its own entry; failures are summarized once.
  const handleFiles = async (files: FileList | null) => {
    const map = ctx.collab.fonts;
    if (!map || !files || files.length === 0) return;
    const projectId = ctx.projectId();
    const list = [...files];
    setPending((p) => p + list.length);
    const errors = await Promise.all(
      list.map(async (file): Promise<string | null> => {
        try {
          const { id } = await uploadFont(projectId, file);
          map.set(file.name, id);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "Font upload failed.";
        } finally {
          setPending((p) => p - 1);
        }
      })
    );
    const failed = errors.filter((m): m is string => m !== null);
    const first = failed[0];
    if (first) {
      toast.error(failed.length === 1 ? first : `${first} (+${String(failed.length - 1)} more)`);
    }
  };

  let fontInput: HTMLInputElement | undefined;
  const openPicker = () => {
    if (!fontInput) return;
    fontInput.value = "";
    fontInput.click();
  };

  return (
    <div
      class="flex h-full flex-col gap-1 p-2"
      onDragOver={(e) => {
        e.preventDefault();
        if (!ctx.isReadOnly()) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!ctx.isReadOnly()) void handleFiles(e.dataTransfer?.files ?? null);
      }}
    >
      <SidebarGroupLabel class="flex items-center justify-between gap-1">
        <span>Fonts</span>
        <Show when={!ctx.isReadOnly()}>
          <UploadButton
            label="Upload fonts"
            uploading={pending()}
            active={dragging()}
            onClick={openPicker}
          />
        </Show>
      </SidebarGroupLabel>

      <Show when={!ctx.isReadOnly()}>
        <input
          ref={(el) => {
            fontInput = el;
          }}
          type="file"
          accept={FONT_ACCEPT}
          multiple
          class="hidden"
          onChange={(e) => {
            const { files } = e.currentTarget;
            e.currentTarget.value = "";
            void handleFiles(files);
          }}
        />
      </Show>

      <Show
        when={groups().length > 0}
        fallback={
          <p class="text-muted-foreground px-2 py-2 text-xs leading-relaxed">
            No custom fonts. Upload a .ttf, .otf, or .ttc (or drop them here), then reference it
            with <code class="text-foreground">{`#set text(font: "Family")`}</code>.
          </p>
        }
      >
        <ul class="flex flex-col gap-0.5">
          <For each={groups()}>
            {([name, members]) => {
              const open = () => expanded().has(name);
              // A real family (vs a filename fallback for an unresolved font) is
              // the only thing worth copying into `#set text(font: ...)`.
              const isFamily = () =>
                members.some(([, blobId]) => ctx.fontFamilies[blobId] === name);
              return (
                <li>
                  <div class="group hover:bg-sidebar-accent flex items-center gap-1 rounded-md text-sm">
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      aria-expanded={open()}
                      class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
                    >
                      <Show
                        when={open()}
                        fallback={
                          <TbOutlineChevronRight size={14} class="text-muted-foreground shrink-0" />
                        }
                      >
                        <TbOutlineChevronDown size={14} class="text-muted-foreground shrink-0" />
                      </Show>
                      <span class="truncate" title={name}>
                        {name}
                      </span>
                      <Show when={members.length > 1}>
                        <span class="text-muted-foreground shrink-0 text-[11px]">
                          {members.length}
                        </span>
                      </Show>
                    </button>
                    <Show when={isFamily()}>
                      <button
                        type="button"
                        onClick={() => {
                          copyFamily(name);
                        }}
                        aria-label={`Copy font family "${name}"`}
                        title="Copy font family"
                        class="text-muted-foreground hover:text-foreground mr-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <TbOutlineCopy size={14} />
                      </button>
                    </Show>
                  </div>
                  <Show when={open()}>
                    <ul class="flex flex-col gap-0.5">
                      <For each={members}>
                        {([filename]) => (
                          <li class="group/f hover:bg-sidebar-accent flex items-center gap-2 rounded-md py-1 pr-2 pl-7 text-xs">
                            <span
                              class="text-muted-foreground min-w-0 flex-1 truncate"
                              title={filename}
                            >
                              {filename}
                            </span>
                            <Show when={!ctx.isReadOnly()}>
                              <button
                                type="button"
                                onClick={() => {
                                  ctx.collab.fonts?.delete(filename);
                                }}
                                aria-label={`Remove ${filename}`}
                                class="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover/f:opacity-100"
                              >
                                <TbOutlineTrash size={13} />
                              </button>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>

      <Show when={entries().length > 0}>
        <p class="text-muted-foreground mt-auto px-2 pt-2 text-[11px]">
          Removing a font takes effect after reload.
        </p>
      </Show>
    </div>
  );
}
