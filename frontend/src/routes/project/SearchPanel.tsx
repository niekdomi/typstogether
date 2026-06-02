import { EditorView } from "@codemirror/view";
import { TbOutlineChevronRight, TbOutlineReplace } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useProjectContext } from "./ProjectContext";

interface SearchMatch {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Splits a line into before/match/after for a result snippet, truncating the surrounding context with an ellipsis.
 */
function snippetParts(lineText: string, matchStart: number, matchEnd: number) {
  const CONTEXT_LENGTH = 30;

  const start = Math.max(0, matchStart - CONTEXT_LENGTH);
  const end = Math.min(lineText.length, matchEnd + CONTEXT_LENGTH);

  return {
    before: (start > 0 ? "…" : "") + lineText.slice(start, matchStart),
    match: lineText.slice(matchStart, matchEnd),
    after: lineText.slice(matchEnd, end) + (end < lineText.length ? "…" : ""),
  };
}

/**
 * Returns the absolute offset where each line begins, to convert a (line, column) match into an offset for editing the Yjs text.
 *
 * @returns An array indexed by line number, where each entry is that line's start offset in the text.
 */
function lineStarts(text: string): number[] {
  const starts = [0];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      starts.push(i + 1);
    }
  }

  return starts;
}

const WORD = /\w/;

/**
 * True if position `i` in `s` is a word boundary (a non-word char or off the string's edge), used to enforce whole-word matching.
 */
const isBoundary = (s: string, i: number) => !WORD.test(s[i] ?? "");

/**
 * Toggle button for a search option (e.g. match case), styled by active state.
 */
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

  // Scans every file for the query, grouping matches by path (sorted).
  const results = createMemo<[string, SearchMatch[]][]>(() => {
    version();
    const q = query().trim();
    const files = ctx.ready()?.files;
    if (!q || !files) {
      return [];
    }

    const caseSensitive = matchCase();
    const needWholeWord = wholeWord();
    const needle = caseSensitive ? q : q.toLowerCase();
    const groups: [string, SearchMatch[]][] = [];

    for (const [path, yText] of files.entries()) {
      const matches: SearchMatch[] = [];
      for (const [line, lineText] of yText.toJSON().split("\n").entries()) {
        const haystack = caseSensitive ? lineText : lineText.toLowerCase();

        for (
          let col = haystack.indexOf(needle);
          col !== -1;
          col = haystack.indexOf(needle, col + needle.length)
        ) {
          const end = col + needle.length;

          if (needWholeWord && !(isBoundary(haystack, col - 1) && isBoundary(haystack, end))) {
            continue;
          }

          matches.push({ path, line, lineText, matchStart: col, matchEnd: end });
        }
      }

      if (matches.length > 0) {
        groups.push([path, matches]);
      }
    }

    return groups.toSorted(([a], [b]) => a.localeCompare(b));
  });

  const totalCount = createMemo(() => results().reduce((s, [, ms]) => s + ms.length, 0));
  const flatMatches = createMemo(() => results().flatMap(([, ms]) => ms));

  /**
   * Opens the match's file and selects + scrolls to the matched range.
   */
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

  /**
   * Replaces a single match in place with the current replace text.
   */
  function replaceOne(match: SearchMatch) {
    const yText = ctx.ready()?.files.get(match.path);
    if (!yText) {
      return;
    }

    const from = lineStarts(yText.toJSON())[match.line]! + match.matchStart;

    yText.delete(from, match.matchEnd - match.matchStart);
    yText.insert(from, replaceText());

    setVersion((v) => v + 1);
  }

  /**
   * Replaces the first remaining match, then jumps to the next one.
   */
  function replaceNext() {
    const match = flatMatches()[0];
    if (!match) {
      return;
    }

    replaceOne(match);

    const next = flatMatches()[0];
    if (next) {
      jumpTo(next);
    }
  }

  /**
   * Replaces every match across all files (right-to-left to keep offsets valid).
   */
  function replaceAll() {
    const files = ctx.ready()?.files;
    if (!files) {
      return;
    }

    const replacement = replaceText();
    for (const [path, matches] of results()) {
      const yText = files.get(path);
      if (!yText) {
        continue;
      }

      const starts = lineStarts(yText.toJSON());
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        if (!m) {
          continue;
        }

        const from = starts[m.line]! + m.matchStart;
        yText.delete(from, m.matchEnd - m.matchStart);
        yText.insert(from, replacement);
      }
    }
    setVersion((v) => v + 1);
  }

  return (
    <div class="flex h-full min-w-0 flex-col overflow-hidden">
      <div class="flex flex-col gap-1.5 p-2">
        <div class="flex h-8 items-center px-2">
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
            class="text-muted-foreground hover:text-foreground flex w-5 shrink-0 justify-center transition-transform"
            classList={{ "rotate-90": showReplace() }}
          >
            <TbOutlineChevronRight size={14} />
          </button>
          <div class="border-border bg-background flex min-w-0 flex-1 items-center rounded-md border px-2.5 py-1.5">
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
                              class="text-muted-foreground hover:text-foreground invisible shrink-0 group-hover:visible"
                            >
                              <TbOutlineReplace size={14} />
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
