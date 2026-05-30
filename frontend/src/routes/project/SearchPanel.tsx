import { EditorView } from "@codemirror/view";
import { TbOutlineChevronRight, TbOutlineSearch } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useProjectContext } from "./ProjectContext";

interface SearchMatch {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

function snippetParts(lineText: string, matchStart: number, matchEnd: number) {
  const CTX = 30;
  const start = Math.max(0, matchStart - CTX);
  const end = Math.min(lineText.length, matchEnd + CTX);
  return {
    before: (start > 0 ? "…" : "") + lineText.slice(start, matchStart),
    match: lineText.slice(matchStart, matchEnd),
    after: lineText.slice(matchEnd, end) + (end < lineText.length ? "…" : ""),
  };
}

function absoluteOffset(text: string, line: number, col: number): number {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < line; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  return offset + col;
}

function OptionButton(props: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.title}
      class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
      classList={{
        "bg-sidebar-accent text-sidebar-accent-foreground": props.active,
        "text-muted-foreground hover:text-foreground": !props.active,
      }}
    >
      {props.label}
    </button>
  );
}

export default function SearchPanel() {
  const ctx = useProjectContext();
  const [query, setQuery] = createSignal("");
  const [replaceText, setReplaceText] = createSignal("");
  const [showReplace, setShowReplace] = createSignal(false);
  const [matchCase, setMatchCase] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [version, setVersion] = createSignal(0);

  const results = createMemo<[string, SearchMatch[]][]>(() => {
    version();
    const q = query().trim();
    const files = ctx.ready()?.files;
    if (!q || !files) return [];

    const caseSensitive = matchCase();
    const needWholeWord = wholeWord();
    const needle = caseSensitive ? q : q.toLowerCase();
    const groups = new Map<string, SearchMatch[]>();

    for (const [path, yText] of files.entries()) {
      const lines = yText.toJSON().split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i] ?? "";
        const haystack = caseSensitive ? lineText : lineText.toLowerCase();
        let col = haystack.indexOf(needle);
        while (col !== -1) {
          const nextCol = haystack.indexOf(needle, col + needle.length);
          if (
            !needWholeWord ||
            (!/\w/.test(haystack[col - 1] ?? "") && !/\w/.test(haystack[col + needle.length] ?? ""))
          ) {
            const arr = groups.get(path) ?? [];
            arr.push({ path, line: i, lineText, matchStart: col, matchEnd: col + q.length });
            groups.set(path, arr);
          }
          col = nextCol;
        }
      }
    }

    return [...groups.entries()].toSorted(([a], [b]) => a.localeCompare(b));
  });

  const totalCount = createMemo(() => results().reduce((s, [, ms]) => s + ms.length, 0));
  const flatMatches = createMemo(() => results().flatMap(([, ms]) => ms));

  const jumpTo = (match: SearchMatch) => {
    ctx.setActiveFile(match.path);
    queueMicrotask(() => {
      const view = ctx.editorView();
      if (!view) return;
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

  function replaceOne(match: SearchMatch) {
    const yText = ctx.ready()?.files.get(match.path);
    if (!yText) return;
    const from = absoluteOffset(yText.toJSON(), match.line, match.matchStart);
    yText.delete(from, match.matchEnd - match.matchStart);
    yText.insert(from, replaceText());
    setVersion((v) => v + 1);
  }

  function replaceNext() {
    const match = flatMatches()[0];
    if (!match) return;
    replaceOne(match);
    const next = flatMatches()[0];
    if (next) jumpTo(next);
  }

  function replaceAll() {
    const files = ctx.ready()?.files;
    if (!files) return;
    const replacement = replaceText();
    for (const [path, matches] of results()) {
      const yText = files.get(path);
      if (!yText) continue;
      const snapshot = yText.toJSON();
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        if (!m) continue;
        const from = absoluteOffset(snapshot, m.line, m.matchStart);
        yText.delete(from, m.matchEnd - m.matchStart);
        yText.insert(from, replacement);
      }
    }
    setVersion((v) => v + 1);
  }

  return (
    <div class="flex h-full min-w-0 flex-col overflow-hidden">
      <div class="flex flex-col gap-1.5 p-2">
        <div class="flex items-center px-1">
          <span class="text-sidebar-foreground/70 flex-1 text-xs font-medium">Search</span>
          <OptionButton
            label="Aa"
            title="Match case"
            active={matchCase()}
            onClick={() => {
              setMatchCase((s) => !s);
            }}
          />
          <OptionButton
            label="ab|"
            title="Whole word"
            active={wholeWord()}
            onClick={() => {
              setWholeWord((s) => !s);
            }}
          />
        </div>

        <div class="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setShowReplace((s) => !s);
            }}
            title="Toggle replace"
            class="text-muted-foreground hover:text-foreground shrink-0 transition-transform"
            classList={{ "rotate-90": showReplace() }}
          >
            <TbOutlineChevronRight size={14} />
          </button>
          <div class="border-border bg-background flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5">
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

        <Show when={showReplace()}>
          <div class="flex min-w-0 flex-col gap-1">
            <div class="flex min-w-0 items-center gap-1">
              <div class="w-5 shrink-0" />
              <div class="border-border bg-background flex min-w-0 flex-1 items-center rounded-md border px-2.5 py-1.5">
                <input
                  type="text"
                  placeholder="Replace…"
                  class="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                  value={replaceText()}
                  onInput={(e) => {
                    setReplaceText(e.currentTarget.value);
                  }}
                />
              </div>
            </div>
            <div class="flex items-center gap-2 pl-6">
              <button
                type="button"
                onClick={replaceNext}
                class="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={replaceAll}
                class="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                Replace All
              </button>
            </div>
          </div>
        </Show>
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
                    {(m) => {
                      const parts = snippetParts(m.lineText, m.matchStart, m.matchEnd);
                      return (
                        <div class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group flex w-full items-center gap-2 rounded px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              jumpTo(m);
                            }}
                            class="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span class="text-muted-foreground w-7 shrink-0 text-right font-mono text-xs">
                              {m.line + 1}
                            </span>
                            <span class="min-w-0 flex-1 font-mono text-xs">
                              {parts.before}
                              <mark class="bg-yellow-200 text-inherit dark:bg-yellow-800">
                                {parts.match}
                              </mark>
                              {parts.after}
                            </span>
                          </button>
                          <Show when={showReplace()}>
                            <button
                              type="button"
                              onClick={() => {
                                replaceOne(m);
                              }}
                              title="Replace"
                              class="text-muted-foreground hover:text-foreground invisible shrink-0 text-xs group-hover:visible"
                            >
                              ↵
                            </button>
                          </Show>
                        </div>
                      );
                    }}
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
