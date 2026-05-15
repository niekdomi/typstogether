import { createMemo, Match, Show, Switch } from "solid-js";

import { assetBlobUrl } from "../../lib/assets/upload";
import { useProjectContext } from "./ProjectContext";

export default function AssetPreview() {
  const ctx = useProjectContext();

  const url = createMemo(() => {
    const r = ctx.ready();
    if (!r) return null;
    const sha = r.assets.get(ctx.activeFile());
    if (!sha) return null;
    return assetBlobUrl(ctx.projectId(), sha);
  });

  const isPdf = createMemo(() => ctx.activeFile().toLowerCase().endsWith(".pdf"));

  return (
    <div class="flex h-full w-full items-center justify-center overflow-auto bg-muted/30 p-6">
      <Show
        when={url()}
        fallback={<span class="text-sm text-muted-foreground">No preview available</span>}
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
