import { EditorView } from "@codemirror/view";
import { TbOutlineSearch } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { SidebarGroupLabel } from "../../components/ui/sidebar";
import { useProjectContext } from "./ProjectContext";

interface SearchMatch {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export default function SearchPanel() {
  const ctx = useProjectContext();
  const [query, setQuery] = createSignal("");

  const results = createMemo<[string, SearchMatch[]][]>(() => {
    const q = query().trim();
    const files = ctx.ready()?.files;
    if (!q || !files) {
      return [];
    }

    const lowercaseQuery = q.toLowerCase();
    const groups = new Map<string, SearchMatch[]>();

    for (const [path, yText] of files.entries()) {
      const lines = yText.toJSON().split("\n");

      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i] ?? "";
        const lowerLine = lineText.toLowerCase();

        for (let col = lowerLine.indexOf(lowercaseQuery); col !== -1; ) {
          const arr = groups.get(path) ?? [];
          arr.push({ path, line: i, lineText, matchStart: col, matchEnd: col + q.length });
          groups.set(path, arr);
          col = lowerLine.indexOf(lowercaseQuery, col + q.length);
        }
      }
    }

    return [...groups.entries()].toSorted(([a], [b]) => a.localeCompare(b));
  });

  const totalCount = createMemo(() => results().reduce((s, [, ms]) => s + ms.length, 0));

  const jumpTo = (match: SearchMatch) => {
    ctx.setActiveFile(match.path);
    queueMicrotask(() => {
      const view = ctx.editorView();
      if (!view) {
        return;
      }

      const doc = view.state.doc;
      const lineInfo = doc.line(Math.min(match.line + 1, doc.lines));
      const from = Math.min(lineInfo.from + match.matchStart, lineInfo.to);

      view.dispatch({
        selection: {
          anchor: from,
          head: Math.min(from + (match.matchEnd - match.matchStart), lineInfo.to),
        },
        effects: EditorView.scrollIntoView(from, { y: "center" }),
      });
      view.focus();
    });
  };

  return (
    <div class="flex h-full flex-col">
      <div class="p-2">
        <SidebarGroupLabel>Search</SidebarGroupLabel>
        <div class="border-border bg-background flex items-center gap-2 rounded-md border px-2.5 py-1.5">
          <TbOutlineSearch size={15} class="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search in files…"
            class="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
            }}
          />
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <Show when={query().trim()}>
          <Show
            when={results().length > 0}
            fallback={<p class="text-muted-foreground px-3 py-2 text-sm italic">No results.</p>}
          >
            <div class="text-muted-foreground mb-1 px-3 text-xs">
              {totalCount()} result{totalCount() === 1 ? "" : "s"}
            </div>
            <For each={results()}>
              {([path, matches]) => (
                <div class="py-1">
                  <div class="text-muted-foreground truncate px-3 py-1 text-xs font-medium">
                    {path}
                  </div>
                  <For each={matches}>
                    {(m) => (
                      <button
                        type="button"
                        onClick={() => {
                          jumpTo(m);
                        }}
                        class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded px-3 py-1.5 text-left"
                      >
                        <span class="text-muted-foreground w-7 shrink-0 text-right font-mono text-xs">
                          {m.line + 1}
                        </span>
                        <span class="min-w-0 flex-1 truncate font-mono text-xs">
                          {m.lineText.slice(0, m.matchStart)}
                          <mark class="bg-yellow-200 text-inherit dark:bg-yellow-800">
                            {m.lineText.slice(m.matchStart, m.matchEnd)}
                          </mark>
                          {m.lineText.slice(m.matchEnd)}
                        </span>
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
