import { createMemo, Match, Show, Switch } from "solid-js";

import { blobUrl } from "../../lib/assets/upload";
import { useProjectContext } from "./ProjectContext";

export default function AssetPreview() {
  const ctx = useProjectContext();

  const url = createMemo(() => {
    const r = ctx.ready();
    if (!r) return null;
    const sha = r.assets.get(ctx.activeFile());
    if (!sha) return null;
    return blobUrl(ctx.projectId(), sha);
  });

  const isPdf = createMemo(() => ctx.activeFile().toLowerCase().endsWith(".pdf"));

  return (
    <div class="bg-muted/30 flex h-full w-full items-center justify-center overflow-auto p-6">
      <Show
        when={url()}
        fallback={<span class="text-muted-foreground text-sm">No preview available</span>}
      >
        {(src) => (
          <Switch>
            <Match when={isPdf()}>
              <embed
                src={src()}
                type="application/pdf"
                class="h-full w-full"
                aria-label={ctx.activeFile()}
              />
            </Match>
            <Match when={!isPdf()}>
              <img
                src={src()}
                alt={ctx.activeFile()}
                class="max-h-full max-w-full object-contain"
              />
            </Match>
          </Switch>
        )}
      </Show>
    </div>
  );
}
