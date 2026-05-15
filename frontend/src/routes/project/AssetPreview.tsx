import { createMemo, Show } from "solid-js";

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

  return (
    <div class="flex h-full w-full items-center justify-center overflow-auto bg-muted/30 p-6">
      <Show
        when={url()}
        fallback={<span class="text-sm text-muted-foreground">No preview available</span>}
      >
        {(src) => (
          <img src={src()} alt={ctx.activeFile()} class="max-h-full max-w-full object-contain" />
        )}
      </Show>
    </div>
  );
}
