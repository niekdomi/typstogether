import { type EditorState, type Extension, EditorSelection } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";

// Constants ───────────────────────────────────────────────────────────────────

/** Heading group: every `= `, `== `, `=== `, … prefix is considered a sibling. */
export const HEADING_GROUP = /^=+ /;
/** List group: bullet `- ` and numbered `+ ` are siblings. */
export const LIST_GROUP = /^[+-] /;

// Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Find an enclosing `prefix…suffix` pair on the line containing the range,
 * allowing other markup between the markers and the range.
 *
 * For symmetric markers (e.g. `*…*`, `_…_`), occurrences on the line are
 * paired sequentially: odd-indexed openers, even-indexed closers.
 *
 * For asymmetric markers (e.g. `#strike[…]`), the nearest `prefix` before the
 * range and nearest `suffix` after the range form a candidate pair.
 */
function findEnclosingPair(
  state: EditorState,
  prefix: string,
  suffix: string,
  rangeFrom: number,
  rangeTo: number
): { open: number; close: number } | null {
  const openAt = state.doc.sliceString(0, rangeFrom).lastIndexOf(prefix);
  if (openAt === -1) {
    return null;
  }

  const closeRel = state.doc.sliceString(rangeTo).indexOf(suffix);
  if (closeRel === -1) {
    return null;
  }

  return { open: openAt, close: rangeTo + closeRel };
}

/**
 * Wrap or unwrap each selected range with `${prefix}…${suffix}`:
 *
 * 1. Selection IS `prefix…suffix` → strip both markers.
 * 2. Else an enclosing pair on the same line wraps the selection → strip.
 * 3. Else → insert markers around the selection.
 */
export function wrapSelection(view: EditorView, prefix: string, suffix = prefix): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;

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

      const pair = findEnclosingPair(state, prefix, suffix, range.from, range.to);
      if (pair) {
        return {
          changes: [
            { from: pair.open, to: pair.open + prefix.length, insert: "" },
            { from: pair.close, to: pair.close + suffix.length, insert: "" },
          ],
          range: range.empty
            ? EditorSelection.cursor(range.from - prefix.length)
            : EditorSelection.range(range.from - prefix.length, range.to - prefix.length),
        };
      }

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
 * - If every touched line already starts with `target` → strip `target`.
 * - Else, per line: replace any sibling in `group` with `target`; otherwise
 *   insert `target`.
 */
export function togglePrefix(view: EditorView, target: string, group?: RegExp): void {
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
          // Already correct.
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

/**
 * CodeMirror keymap for the format actions. `Mod` resolves to Ctrl on
 * Windows/Linux and Cmd on macOS.
 */
export const formatKeymap: Extension = keymap.of([
  {
    key: "Mod-b",
    run: (v) => {
      wrapSelection(v, "*");
      return true;
    },
  },
  {
    key: "Mod-i",
    run: (v) => {
      wrapSelection(v, "_");
      return true;
    },
  },
  {
    key: "Mod-Shift-x",
    run: (v) => {
      wrapSelection(v, "#strike[", "]");
      return true;
    },
  },
  {
    key: "Mod-e",
    run: (v) => {
      wrapSelection(v, "`");
      return true;
    },
  },
  {
    key: "Mod-k",
    run: (v) => {
      insertLink(v);
      return true;
    },
  },
  {
    key: "Mod-Alt-1",
    run: (v) => {
      togglePrefix(v, "= ", HEADING_GROUP);
      return true;
    },
  },
  {
    key: "Mod-Alt-2",
    run: (v) => {
      togglePrefix(v, "== ", HEADING_GROUP);
      return true;
    },
  },
  {
    key: "Mod-Alt-3",
    run: (v) => {
      togglePrefix(v, "=== ", HEADING_GROUP);
      return true;
    },
  },
  {
    key: "Mod-Shift-8",
    run: (v) => {
      togglePrefix(v, "- ", LIST_GROUP);
      return true;
    },
  },
  {
    key: "Mod-Shift-7",
    run: (v) => {
      togglePrefix(v, "+ ", LIST_GROUP);
      return true;
    },
  },
]);
