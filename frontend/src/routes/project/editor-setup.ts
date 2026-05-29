import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";

/**
 * Line-number gutter that respects the user's prefs.
 * - `show=false`  → no gutter at all.
 * - `relative=true` → current line shows its absolute number; others show their
 *   distance from the cursor (vim-style). The companion update listener forces
 *   a transaction on selection changes so the gutter recomputes.
 */
export function buildLineNumbers(show: boolean, relative: boolean): Extension {
  if (!show) return [];
  if (!relative) return lineNumbers();
  return [
    lineNumbers({
      formatNumber: (lineNo, state) => {
        if (lineNo > state.doc.lines) return "";
        const cursorLine = state.doc.lineAt(state.selection.main.head).number;
        return lineNo === cursorLine ? String(lineNo) : String(Math.abs(lineNo - cursorLine));
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.selectionSet && !update.docChanged) {
        queueMicrotask(() => {
          update.view.dispatch({});
        });
      }
    }),
  ];
}

// `basicSetup` from `codemirror` with `history()` + `historyKeymap` removed:
// `yCollab` + `Y.UndoManager` own undo/redo so the local CM history would
// otherwise quietly accumulate state and risk shadowing collab-aware undo.
export const editorSetup: Extension = [
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
];
