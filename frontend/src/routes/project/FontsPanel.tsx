import { TbOutlineTrash, TbOutlineUpload } from "solid-icons/tb";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { toast } from "somoto";

import { uploadFont } from "../../lib/fonts/upload";
import { useProjectContext } from "./ProjectContext";

const FONT_ACCEPT = ".ttf,.otf,.ttc";

// Manage the project's custom fonts (the `fonts` Y.Map). Upload registers the
// font with every collaborator's compiler via useFontsSync; removal applies on
// reload since the engine has no live unregister.
export default function FontsPanel() {
  const ctx = useProjectContext();
  const [names, setNames] = createSignal<string[]>([]);

  // The Y.Map isn't reactive; mirror its keys (font filenames) into a signal.
  createEffect(() => {
    const map = ctx.collab.fonts;
    if (!map) {
      setNames([]);
      return;
    }
    const refresh = () => setNames([...map.keys()].toSorted((a, b) => a.localeCompare(b)));
    refresh();
    map.observe(refresh);
    onCleanup(() => {
      map.unobserve(refresh);
    });
  });

  const handleFile = async (file: File | undefined) => {
    const map = ctx.collab.fonts;
    if (!file || !map) return;
    try {
      const { id } = await uploadFont(ctx.projectId(), file);
      map.set(file.name, id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Font upload failed.");
    }
  };

  return (
    <div class="flex h-full flex-col gap-1 p-3">
      <p class="text-muted-foreground px-1 py-1.5 text-xs font-medium tracking-wide uppercase">
        Fonts
      </p>

      <Show when={!ctx.isReadOnly()}>
        <label class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-sm">
          <TbOutlineUpload size={14} />
          <span>Upload font</span>
          <input
            type="file"
            accept={FONT_ACCEPT}
            class="sr-only"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              void handleFile(file);
            }}
          />
        </label>
      </Show>

      <Show
        when={names().length > 0}
        fallback={
          <p class="text-muted-foreground px-2 py-2 text-xs leading-relaxed">
            No custom fonts. Upload a .ttf, .otf, or .ttc, then reference it with{" "}
            <code class="text-foreground">{`#set text(font: "Family")`}</code>.
          </p>
        }
      >
        <ul class="flex flex-col gap-0.5">
          <For each={names()}>
            {(name) => (
              <li class="group hover:bg-sidebar-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <span class="min-w-0 flex-1 truncate" title={name}>
                  {name}
                </span>
                <Show when={!ctx.isReadOnly()}>
                  <button
                    type="button"
                    onClick={() => {
                      ctx.collab.fonts?.delete(name);
                    }}
                    aria-label={`Remove ${name}`}
                    class="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <TbOutlineTrash size={14} />
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={names().length > 0}>
        <p class="text-muted-foreground mt-auto px-2 pt-2 text-[11px]">
          Removing a font takes effect after reload.
        </p>
      </Show>
    </div>
  );
}
