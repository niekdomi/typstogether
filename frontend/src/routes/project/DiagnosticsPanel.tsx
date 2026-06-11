import type { Diagnostic } from "@vedivad/codemirror-typst";
import { TbOutlineAlertCircle, TbOutlineAlertTriangle } from "solid-icons/tb";
import { createMemo, For, Show } from "solid-js";

import { Spinner } from "../../components/Spinner";
import { SidebarGroupLabel } from "../../components/ui/sidebar";
import { useProjectContext } from "./ProjectContext";

const SEVERITY_RANK: Record<Diagnostic["severity"], number> = {
  error: 0,
  warning: 1,
};

function SeverityIcon(props: { severity: Diagnostic["severity"] }) {
  if (props.severity === "error") {
    return <TbOutlineAlertCircle class="text-destructive mt-0.5 size-4 shrink-0" />;
  }
  return <TbOutlineAlertTriangle class="mt-0.5 size-4 shrink-0 text-yellow-500" />;
}

export default function DiagnosticsPanel() {
  const ctx = useProjectContext();

  // Group by file path, files sorted alphabetically, diagnostics sorted by severity then line.
  const byFile = createMemo<[string, Diagnostic[]][]>(() => {
    const groups = new Map<string, Diagnostic[]>();
    for (const d of ctx.diagnostics()) {
      const file = d.location?.file ?? "";
      const arr = groups.get(file) ?? [];
      arr.push(d);
      groups.set(file, arr);
    }
    return [...groups.entries()]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([path, list]) => [
        path,
        list.toSorted(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
            (a.location?.line ?? 0) - (b.location?.line ?? 0)
        ),
      ]);
  });

  const jumpTo = (d: Diagnostic) => {
    if (d.location) ctx.gotoSource(d.location.file, d.location.line, d.location.column);
  };

  return (
    <div class="flex h-full flex-col p-2">
      <SidebarGroupLabel>Problems</SidebarGroupLabel>
      <div class="min-h-0 flex-1 overflow-auto">
        <Show
          when={ctx.previewReady()}
          fallback={
            <p class="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm italic">
              <Spinner />
              Loading project resources…
            </p>
          }
        >
          <Show
            when={ctx.diagnostics().length > 0}
            fallback={
              <p class="text-muted-foreground px-3 py-2 text-sm italic">No problems detected.</p>
            }
          >
            <For each={byFile()}>
              {([path, list]) => (
                <div class="py-1">
                  <div class="text-muted-foreground truncate px-3 py-1 text-xs font-medium">
                    {path}
                  </div>
                  <For each={list}>
                    {(d) => (
                      <button
                        type="button"
                        onClick={() => {
                          jumpTo(d);
                        }}
                        class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm"
                      >
                        <SeverityIcon severity={d.severity} />
                        <div class="min-w-0 flex-1">
                          <div class="line-clamp-2 leading-snug">{d.message}</div>
                          <Show when={d.location}>
                            {(loc) => (
                              <div class="text-muted-foreground mt-0.5 text-xs">
                                Line {loc().line}, col {loc().column}
                              </div>
                            )}
                          </Show>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}
