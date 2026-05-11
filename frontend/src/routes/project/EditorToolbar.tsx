import { EditorSelection } from "@codemirror/state";
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
 * Replace each selected range with `${prefix}${range}${suffix}`, reselecting the
 * original text. Collapsed ranges insert the markers and place the cursor
 * between them. Handles multi-cursors via `state.changeByRange`.
 */
function wrapSelection(view: EditorView, prefix: string, suffix = prefix): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      if (range.empty) {
        return {
          changes: { from: range.from, insert: prefix + suffix },
          range: EditorSelection.cursor(range.from + prefix.length),
        };
      }
      const text = view.state.sliceDoc(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: prefix + text + suffix },
        range: EditorSelection.range(
          range.from + prefix.length,
          range.from + prefix.length + text.length
        ),
      };
    }),
    { userEvent: "input.format.wrap" }
  );
  view.focus();
}

/** Insert `prefix` at the start of every line touched by each selected range. */
function prefixLines(view: EditorView, prefix: string): void {
  view.dispatch(
    view.state.changeByRange((range) => {
      const firstLine = view.state.doc.lineAt(range.from).number;
      const lastLine = view.state.doc.lineAt(range.to).number;
      const changes = [];
      for (let n = firstLine; n <= lastLine; n++) {
        const line = view.state.doc.line(n);
        changes.push({ from: line.from, insert: prefix });
      }
      // Keep the range as-is — CM auto-adjusts it for the inserts before it.
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

const groups: ToolbarGroup[] = [
  {
    items: [
      {
        icon: () => <TbOutlineH1 />,
        label: "Heading 1",
        run: (v) => {
          prefixLines(v, "= ");
        },
      },
      {
        icon: () => <TbOutlineH2 />,
        label: "Heading 2",
        run: (v) => {
          prefixLines(v, "== ");
        },
      },
      {
        icon: () => <TbOutlineH3 />,
        label: "Heading 3",
        run: (v) => {
          prefixLines(v, "=== ");
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
          prefixLines(v, "- ");
        },
      },
      {
        icon: () => <TbOutlineListNumbers />,
        label: "Numbered list",
        run: (v) => {
          prefixLines(v, "+ ");
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
