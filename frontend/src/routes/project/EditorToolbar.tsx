import { type EditorState, EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  TbOutlineBold,
  TbOutlineCode,
  TbOutlineH1,
  TbOutlineH2,
  TbOutlineH3,
  TbOutlineItalic,
  TbOutlineLink,
  TbOutlineList,
  TbOutlineListNumbers,
  TbOutlineStrikethrough,
} from "solid-icons/tb";
import { For, type JSX } from "solid-js";

import { Button } from "../../components/ui/button";

// Action helpers ──────────────────────────────────────────────────────────────

/**
 * Find an enclosing `prefix…suffix` pair on the line containing the range,
 * allowing other markup between the markers and the range. Returns the
 * doc-absolute marker positions or `null` if no enclosing pair exists.
 *
 * For symmetric markers (e.g. `*…*`, `_…_`), occurrences on the line are
 * paired sequentially: odd-indexed openers, even-indexed closers. A pair
 * encloses the range iff the range fits strictly between them.
 *
 * For asymmetric markers (e.g. `#strike[…]`), the nearest `prefix` before the
 * range and nearest `suffix` after the range form a candidate pair. Nested
 * structures with the same markers aren't perfectly handled — good enough
 * for the common cases.
 */
function findEnclosingPair(
  state: EditorState,
  prefix: string,
  suffix: string,
  rangeFrom: number,
  rangeTo: number
): { open: number; close: number } | null {
  const line = state.doc.lineAt(rangeFrom);
  if (line.to < rangeTo) return null; // selection spans lines; skip

  const text = line.text;
  const start = rangeFrom - line.from;
  const end = rangeTo - line.from;

  if (prefix === suffix) {
    const positions: number[] = [];
    let i = 0;
    while (i <= text.length - prefix.length) {
      if (text.startsWith(prefix, i)) {
        positions.push(i);
        i += prefix.length;
      } else {
        i++;
      }
    }
    for (let k = 0; k + 1 < positions.length; k += 2) {
      const open = positions[k]!;
      const close = positions[k + 1]!;
      if (open + prefix.length <= start && end <= close) {
        return { open: line.from + open, close: line.from + close };
      }
    }
    return null;
  }

  // Asymmetric: nearest prefix before, nearest suffix after.
  let openAt = -1;
  for (let i = 0; i + prefix.length <= start; i++) {
    if (text.startsWith(prefix, i)) openAt = i;
  }
  if (openAt < 0) return null;

  let closeAt = -1;
  for (let i = end; i + suffix.length <= text.length; i++) {
    if (text.startsWith(suffix, i)) {
      closeAt = i;
      break;
    }
  }
  if (closeAt < 0) return null;

  return { open: line.from + openAt, close: line.from + closeAt };
}

/**
 * Wrap each selected range with `${prefix}…${suffix}`, OR unwrap if there's
 * an enclosing `prefix…suffix` pair on the same line:
 *
 * 1. If the selection itself reads `prefix…suffix` → strip both markers.
 * 2. Else search the line for an enclosing pair (allowing other markup
 *    between the markers and the selection) → strip those markers.
 * 3. Otherwise → insert the markers around the selection.
 *
 * Handles multi-cursors via `state.changeByRange`.
 */
function wrapSelection(view: EditorView, prefix: string, suffix = prefix): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;

      // Case 1: selection contains the markers.
      if (!range.empty && range.to - range.from >= prefix.length + suffix.length) {
        const text = state.sliceDoc(range.from, range.to);
        if (text.startsWith(prefix) && text.endsWith(suffix)) {
          const inner = text.slice(prefix.length, text.length - suffix.length);
          return {
            changes: { from: range.from, to: range.to, insert: inner },
            range: EditorSelection.range(range.from, range.from + inner.length),
          };
        }
      }

      // Case 2: enclosing pair on the same line.
      const pair = findEnclosingPair(state, prefix, suffix, range.from, range.to);
      if (pair) {
        return {
          changes: [
            { from: pair.open, to: pair.open + prefix.length, insert: "" },
            { from: pair.close, to: pair.close + suffix.length, insert: "" },
          ],
          // The selection shifts left by `prefix.length` (the chars deleted
          // before it). The chars after `range.to` deleted shift nothing
          // before it.
          range: range.empty
            ? EditorSelection.cursor(range.from - prefix.length)
            : EditorSelection.range(range.from - prefix.length, range.to - prefix.length),
        };
      }

      // Case 3: wrap.
      if (range.empty) {
        return {
          changes: { from: range.from, insert: prefix + suffix },
          range: EditorSelection.cursor(range.from + prefix.length),
        };
      }
      const inner = state.sliceDoc(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: prefix + inner + suffix },
        range: EditorSelection.range(
          range.from + prefix.length,
          range.from + prefix.length + inner.length
        ),
      };
    }),
    { userEvent: "input.format.wrap" }
  );
  view.focus();
}

/**
 * Add/replace/strip a line-start prefix on every line touched by each range.
 *
 * - If every touched line already starts with `target` → strip `target` from
 *   all of them (toggle off).
 * - Else, per line: if it matches a sibling in `group` (e.g. another heading
 *   level), replace that prefix with `target`. Otherwise insert `target`.
 *
 * When `group` is omitted, the same line-start prefix is the only one
 * considered — clicking the action on a line that already has it is a no-op
 * (the "all have" check covers the strip path).
 */
function togglePrefix(view: EditorView, target: string, group?: RegExp): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;
      const firstLine = state.doc.lineAt(range.from).number;
      const lastLine = state.doc.lineAt(range.to).number;

      let allHaveTarget = true;
      for (let n = firstLine; n <= lastLine; n++) {
        if (!state.doc.line(n).text.startsWith(target)) {
          allHaveTarget = false;
          break;
        }
      }

      const changes = [];
      for (let n = firstLine; n <= lastLine; n++) {
        const line = state.doc.line(n);
        if (allHaveTarget) {
          changes.push({ from: line.from, to: line.from + target.length, insert: "" });
        } else if (line.text.startsWith(target)) {
          // Already correct — nothing to do.
        } else if (group) {
          const match = group.exec(line.text);
          if (match) {
            changes.push({
              from: line.from,
              to: line.from + match[0].length,
              insert: target,
            });
          } else {
            changes.push({ from: line.from, insert: target });
          }
        } else {
          changes.push({ from: line.from, insert: target });
        }
      }
      return { changes, range };
    }),
    { userEvent: "input.format.prefix" }
  );
  view.focus();
}

/** Insert a Typst `#link("url")[text]` template with cursor in the URL slot. */
function insertLink(view: EditorView): void {
  const before = '#link("';
  const url = "https://";
  const middle = '")[';
  const after = "]";
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: before + url + middle + text + after },
        range: EditorSelection.cursor(range.from + before.length + url.length),
      };
    }),
    { userEvent: "input.format.link" }
  );
  view.focus();
}

// Toolbar ─────────────────────────────────────────────────────────────────────

interface Props {
  view: () => EditorView | null;
  readOnly: () => boolean;
}

interface ToolbarAction {
  icon: () => JSX.Element;
  label: string;
  run: (view: EditorView) => void;
}

interface ToolbarGroup {
  items: ToolbarAction[];
}

// Group regexes for replace-between-siblings behavior.
const HEADING_GROUP = /^=+ /;
const LIST_GROUP = /^[+-] /;

const groups: ToolbarGroup[] = [
  {
    items: [
      {
        icon: () => <TbOutlineH1 />,
        label: "Heading 1",
        run: (v) => {
          togglePrefix(v, "= ", HEADING_GROUP);
        },
      },
      {
        icon: () => <TbOutlineH2 />,
        label: "Heading 2",
        run: (v) => {
          togglePrefix(v, "== ", HEADING_GROUP);
        },
      },
      {
        icon: () => <TbOutlineH3 />,
        label: "Heading 3",
        run: (v) => {
          togglePrefix(v, "=== ", HEADING_GROUP);
        },
      },
    ],
  },
  {
    items: [
      {
        icon: () => <TbOutlineBold />,
        label: "Bold",
        run: (v) => {
          wrapSelection(v, "*");
        },
      },
      {
        icon: () => <TbOutlineItalic />,
        label: "Italic",
        run: (v) => {
          wrapSelection(v, "_");
        },
      },
      {
        icon: () => <TbOutlineStrikethrough />,
        label: "Strikethrough",
        run: (v) => {
          wrapSelection(v, "#strike[", "]");
        },
      },
      {
        icon: () => <TbOutlineCode />,
        label: "Inline code",
        run: (v) => {
          wrapSelection(v, "`");
        },
      },
    ],
  },
  {
    items: [
      {
        icon: () => <TbOutlineList />,
        label: "Bullet list",
        run: (v) => {
          togglePrefix(v, "- ", LIST_GROUP);
        },
      },
      {
        icon: () => <TbOutlineListNumbers />,
        label: "Numbered list",
        run: (v) => {
          togglePrefix(v, "+ ", LIST_GROUP);
        },
      },
    ],
  },
  {
    items: [{ icon: () => <TbOutlineLink />, label: "Link", run: insertLink }],
  },
];

export default function EditorToolbar(props: Props) {
  const disabled = () => !props.view() || props.readOnly();

  return (
    <div class="flex shrink-0 items-center gap-1 border-b border-border/60 px-2 py-1">
      <For each={groups}>
        {(group, i) => (
          <>
            {i() > 0 && <div class="mx-1 h-5 w-px bg-border/60" />}
            <For each={group.items}>
              {(action) => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={action.label}
                  aria-label={action.label}
                  disabled={disabled()}
                  onClick={() => {
                    const v = props.view();
                    if (v) action.run(v);
                  }}
                >
                  {action.icon()}
                </Button>
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}
