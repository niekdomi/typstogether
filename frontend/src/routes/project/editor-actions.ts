import { type EditorState, type Extension, EditorSelection } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";

// Constants ───────────────────────────────────────────────────────────────────

/** Heading group: every `= `, `== `, `=== `, … prefix is considered a sibling. */
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

/** Toggle `prefix…suffix` markers around each selected range. */
export function wrapSelection(view: EditorView, prefix: string, suffix = prefix): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const state = view.state;

      // The selection itself is `prefix…suffix` -> strip the markers.
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
        return [{ from: line.from, insert: target }];
      });

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
    { key: "Mod-e", run: wrap("`") },
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
