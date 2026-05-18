import { type EditorState, type Extension, EditorSelection } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

// Constants ───────────────────────────────────────────────────────────────────

/** Heading group: every `= `, `== `, `=== `, ... prefix is considered a sibling. */
export const HEADING_GROUP = /^=+ /;
/** List group: bullet `- ` and numbered `+ ` are siblings. */
export const LIST_GROUP = /^[+-] /;

// Helpers ─────────────────────────────────────────────────────────────────────

function findEnclosingPair(
  state: EditorState,
  prefix: string,
  suffix: string,
  rangeFrom: number,
  rangeTo: number
): { open: number; close: number } | null {
  if (prefix === suffix) {
    // Collect all marker positions and pair them sequentially (even = open, odd = close).
    // This prevents `*foo* bar *baz*` from being treated as enclosing `bar`.
    const text = state.doc.sliceString(0);
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
      if (open + prefix.length <= rangeFrom && rangeTo <= close) {
        return { open, close };
      }
    }
    return null;
  }

  // Asymmetric markers (e.g. `#strike[...]`): nearest prefix before, nearest suffix after.
  const openAt = state.doc.sliceString(0, rangeFrom).lastIndexOf(prefix);
  if (openAt === -1) return null;
  const closeRel = state.doc.sliceString(rangeTo).indexOf(suffix);
  if (closeRel === -1) return null;
  return { open: openAt, close: rangeTo + closeRel };
}

/** Toggle `prefix` ... `suffix` markers around each selected range. */
export function wrapSelection(view: EditorView, prefix: string, suffix = prefix): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;

      // The selection itself is `prefix` ... `suffix` -> strip the markers.
      const selLen = range.to - range.from;
      if (selLen >= prefix.length + suffix.length) {
        const text = state.sliceDoc(range.from, range.to);
        if (text.startsWith(prefix) && text.endsWith(suffix)) {
          const inner = text.slice(prefix.length, text.length - suffix.length);
          return {
            changes: { from: range.from, to: range.to, insert: inner },
            range: EditorSelection.range(range.from, range.from + inner.length),
          };
        }
      }

      // The selection sits inside an enclosing pair -> strip those markers.
      const pair = findEnclosingPair(state, prefix, suffix, range.from, range.to);
      if (pair) {
        // Removing the open marker shifts positions left by prefix.length.
        const newFrom = range.from - prefix.length;
        const newTo = range.to - prefix.length;
        return {
          changes: [
            { from: pair.open, to: pair.open + prefix.length, insert: "" },
            { from: pair.close, to: pair.close + suffix.length, insert: "" },
          ],
          range: range.empty
            ? EditorSelection.cursor(newFrom)
            : EditorSelection.range(newFrom, newTo),
        };
      }

      // No enclosing markers -> insert an empty pair at cursor or wrap the selection.
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

/** Toggle a line-start prefix on every line touched by each range. */
export function togglePrefix(view: EditorView, target: string, group?: RegExp): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;
      const firstLine = state.doc.lineAt(range.from).number;
      const lastLine = state.doc.lineAt(range.to).number;
      const lines = Array.from({ length: lastLine - firstLine + 1 }, (_, i) =>
        state.doc.line(firstLine + i)
      );

      // If every line already has the prefix, remove it; otherwise add it.
      const removing = lines.every((line) => line.text.startsWith(target));

      const changes = lines.flatMap((line) => {
        if (removing) {
          return [{ from: line.from, to: line.from + target.length, insert: "" }];
        }
        if (line.text.startsWith(target)) {
          return []; // already has the target prefix
        }
        const sibling = group?.exec(line.text);
        if (sibling) {
          return [{ from: line.from, to: line.from + sibling[0].length, insert: target }];
        }
        return [{ from: line.from, to: line.from, insert: target }];
      });

      // Shift the selection to account for insertions/deletions at or before each boundary.
      // Without this, CodeMirror maps a cursor at line.from to before the inserted prefix.
      let fromShift = 0;
      let toShift = 0;
      for (const ch of changes) {
        const net = ch.insert.length - (ch.to - ch.from);
        if (ch.from <= range.from) fromShift += net;
        if (ch.from <= range.to) toShift += net;
      }

      return {
        changes,
        range: range.empty
          ? EditorSelection.cursor(range.from + fromShift)
          : EditorSelection.range(range.from + fromShift, range.to + toShift),
      };
    }),
    { userEvent: "input.format.prefix" }
  );
  view.focus();
}

/** Insert a Typst `#link("url")[text]` template with cursor in the URL slot. */
export function insertLink(view: EditorView): void {
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

/** Cycle code formatting: none -> `...` -> ```\n...\n``` -> none. */
export function toggleCode(view: EditorView): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;
      const text = state.sliceDoc(range.from, range.to);

      // Selection IS a code block -> strip (block markers are ```\n and \n```)
      if (text.startsWith("```\n") && text.endsWith("\n```") && text.length >= 8) {
        const inner = text.slice(4, -4);
        return {
          changes: { from: range.from, to: range.to, insert: inner },
          range: EditorSelection.range(range.from, range.from + inner.length),
        };
      }

      // Cursor/selection inside a code block -> strip
      const blockPair = findEnclosingPair(state, "```\n", "\n```", range.from, range.to);
      if (blockPair) {
        return {
          changes: [
            { from: blockPair.open, to: blockPair.open + 4, insert: "" },
            { from: blockPair.close, to: blockPair.close + 4, insert: "" },
          ],
          range: range.empty
            ? EditorSelection.cursor(range.from - 4)
            : EditorSelection.range(range.from - 4, range.to - 4),
        };
      }

      // Selection IS inline code -> upgrade to code block
      if (text.startsWith("`") && text.endsWith("`") && text.length >= 2) {
        const inner = text.slice(1, -1);
        return {
          changes: { from: range.from, to: range.to, insert: "```\n" + inner + "\n```" },
          range: EditorSelection.range(range.from + 4, range.from + 4 + inner.length),
        };
      }

      // Cursor/selection inside inline code -> upgrade to code block
      // (+3 to range because ```\n replaces the `, adding 3 chars before the range)
      const inlinePair = findEnclosingPair(state, "`", "`", range.from, range.to);
      if (inlinePair) {
        return {
          changes: [
            { from: inlinePair.open, to: inlinePair.open + 1, insert: "```\n" },
            { from: inlinePair.close, to: inlinePair.close + 1, insert: "\n```" },
          ],
          range: range.empty
            ? EditorSelection.cursor(range.from + 3)
            : EditorSelection.range(range.from + 3, range.to + 3),
        };
      }

      // No code -> wrap in inline code
      if (range.empty) {
        return {
          changes: { from: range.from, insert: "``" },
          range: EditorSelection.cursor(range.from + 1),
        };
      }
      return {
        changes: { from: range.from, to: range.to, insert: "`" + text + "`" },
        range: EditorSelection.range(range.from + 1, range.from + 1 + text.length),
      };
    }),
    { userEvent: "input.format.wrap" }
  );
  view.focus();
}

// Display math requires whitespace (space or newline) on BOTH sides.
function isMathWhiteSpace(ch: string): boolean {
  return ch === " " || ch === "\n";
}

function isPairDisplay(open: number, close: number, state: EditorState): boolean {
  return (
    isMathWhiteSpace(state.sliceDoc(open + 1, open + 2)) &&
    isMathWhiteSpace(state.sliceDoc(close - 1, close))
  );
}

/** Cycle math formatting: none -> $...$ -> $ ... $ -> none. */
export function toggleMath(view: EditorView): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;
      const text = state.sliceDoc(range.from, range.to);

      // Selection IS display math ($[ws]...[ws]$) -> strip
      if (
        text.startsWith("$") &&
        text.endsWith("$") &&
        text.length >= 4 &&
        isMathWhiteSpace(text[1]!) &&
        isMathWhiteSpace(text.at(-2)!)
      ) {
        const inner = text.slice(2, -2);
        return {
          changes: { from: range.from, to: range.to, insert: inner },
          range: EditorSelection.range(range.from, range.from + inner.length),
        };
      }

      // Selection IS inline math ($...$) -> upgrade to display math
      if (text.startsWith("$") && text.endsWith("$") && text.length >= 2) {
        const inner = text.slice(1, -1);
        return {
          changes: { from: range.from, to: range.to, insert: "$ " + inner + " $" },
          range: EditorSelection.range(range.from + 2, range.from + 2 + inner.length),
        };
      }

      // Cursor/selection: find the enclosing $ pair and classify it.
      const pair = findEnclosingPair(state, "$", "$", range.from, range.to);
      if (pair) {
        if (isPairDisplay(pair.open, pair.close, state)) {
          // Display math -> strip the $ and its adjacent whitespace character
          return {
            changes: [
              { from: pair.open, to: pair.open + 2, insert: "" },
              { from: pair.close - 1, to: pair.close + 1, insert: "" },
            ],
            range: range.empty
              ? EditorSelection.cursor(range.from - 2)
              : EditorSelection.range(range.from - 2, range.to - 2),
          };
        }
        // Inline math -> upgrade to display (+1 because "$ " replaces "$")
        return {
          changes: [
            { from: pair.open, to: pair.open + 1, insert: "$ " },
            { from: pair.close, to: pair.close + 1, insert: " $" },
          ],
          range: range.empty
            ? EditorSelection.cursor(range.from + 1)
            : EditorSelection.range(range.from + 1, range.to + 1),
        };
      }

      // No math -> wrap in inline math
      if (range.empty) {
        return {
          changes: { from: range.from, insert: "$$" },
          range: EditorSelection.cursor(range.from + 1),
        };
      }
      return {
        changes: { from: range.from, to: range.to, insert: "$" + text + "$" },
        range: EditorSelection.range(range.from + 1, range.from + 1 + text.length),
      };
    }),
    { userEvent: "input.format.wrap" }
  );
  view.focus();
}

/** CodeMirror keymap for the format actions. `Mod` = Ctrl / Cmd. */
export const formatKeymap: Extension = (() => {
  const wrap =
    (p: string, s = p) =>
    (v: EditorView) => {
      wrapSelection(v, p, s);
      return true;
    };

  const prefix = (p: string, g: RegExp) => (v: EditorView) => {
    togglePrefix(v, p, g);
    return true;
  };

  return keymap.of([
    { key: "Mod-b", run: wrap("*") },
    { key: "Mod-i", run: wrap("_") },
    { key: "Mod-Shift-x", run: wrap("#strike[", "]") },
    { key: "Mod-u", run: wrap("#underline[", "]") },
    {
      key: "Mod-e",
      run: (v) => {
        toggleCode(v);
        return true;
      },
    },
    { key: "Mod-,", run: wrap("#sub[", "]") },
    { key: "Mod-.", run: wrap("#super[", "]") },
    {
      key: "Mod-k",
      run: (v) => {
        insertLink(v);
        return true;
      },
    },
    { key: "Mod-Alt-1", run: prefix("= ", HEADING_GROUP) },
    { key: "Mod-Alt-2", run: prefix("== ", HEADING_GROUP) },
    { key: "Mod-Alt-3", run: prefix("=== ", HEADING_GROUP) },
    { key: "Mod-Shift-8", run: prefix("- ", LIST_GROUP) },
    { key: "Mod-Shift-7", run: prefix("+ ", LIST_GROUP) },
  ]);
})();

// File-drop ───────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);

/** Wrap a Typst VFS path in the right directive for its extension. */
export function formatPathForDrop(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot).toLowerCase();
  if (ext === ".typ") return `#include "${path}"`;
  if (IMAGE_EXTS.has(ext)) return `#image("${path}")`;
  return `"${path}"`;
}

/**
 * Replace CodeMirror's default file-path paste on drop with a Typst directive.
 * The file sidebar puts the dragged file's VFS path (e.g. `/foo/bar.typ`) into
 * `text/plain`; we wrap it as `#include "..."` / `#image("...")` instead of
 * inserting the bare path.
 */
export const fileDropHandler: Extension = EditorView.domEventHandlers({
  drop(event, view) {
    const data = event.dataTransfer?.getData("text/plain");
    if (!data || !data.startsWith("/")) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    event.preventDefault();
    const text = formatPathForDrop(data);
    view.dispatch({
      changes: { from: pos, insert: text },
      selection: EditorSelection.cursor(pos + text.length),
      userEvent: "input.drop",
    });
    view.focus();
    return true;
  },
});
