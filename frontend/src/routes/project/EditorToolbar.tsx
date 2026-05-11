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
  TbOutlineSubscript,
  TbOutlineSuperscript,
} from "solid-icons/tb";
import { For, type JSX } from "solid-js";

import { Button } from "../../components/ui/button";
import {
  HEADING_GROUP,
  insertLink,
  LIST_GROUP,
  togglePrefix,
  wrapSelection,
} from "./editor-actions";

interface Props {
  view: () => EditorView | null;
  readOnly: () => boolean;
}

interface ToolbarAction {
  icon: () => JSX.Element;
  label: string;
  shortcut: string;
  run: (view: EditorView) => void;
}

interface ToolbarGroup {
  items: ToolbarAction[];
}

// Display the format-keymap shortcuts in the OS-native style.
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const SHIFT = IS_MAC ? "⇧" : "Shift";
const ALT = IS_MAC ? "⌥" : "Alt";
const SEP = IS_MAC ? "" : "+";
const sc = (...parts: string[]) => parts.join(SEP);

const groups: ToolbarGroup[] = [
  {
    items: [
      {
        icon: () => <TbOutlineH1 />,
        label: "Heading 1",
        shortcut: sc(MOD, ALT, "1"),
        run: (v) => {
          togglePrefix(v, "= ", HEADING_GROUP);
        },
      },
      {
        icon: () => <TbOutlineH2 />,
        label: "Heading 2",
        shortcut: sc(MOD, ALT, "2"),
        run: (v) => {
          togglePrefix(v, "== ", HEADING_GROUP);
        },
      },
      {
        icon: () => <TbOutlineH3 />,
        label: "Heading 3",
        shortcut: sc(MOD, ALT, "3"),
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
        shortcut: sc(MOD, "B"),
        run: (v) => {
          wrapSelection(v, "*");
        },
      },
      {
        icon: () => <TbOutlineItalic />,
        label: "Italic",
        shortcut: sc(MOD, "I"),
        run: (v) => {
          wrapSelection(v, "_");
        },
      },
      {
        icon: () => <TbOutlineStrikethrough />,
        label: "Strikethrough",
        shortcut: sc(MOD, SHIFT, "X"),
        run: (v) => {
          wrapSelection(v, "#strike[", "]");
        },
      },
      {
        icon: () => <TbOutlineCode />,
        label: "Inline code",
        shortcut: sc(MOD, "E"),
        run: (v) => {
          wrapSelection(v, "`");
        },
      },
      {
        icon: () => <TbOutlineSubscript />,
        label: "Subscript",
        shortcut: sc(MOD, ","),
        run: (v) => {
          wrapSelection(v, "#sub[", "]");
        },
      },
      {
        icon: () => <TbOutlineSuperscript />,
        label: "Superscript",
        shortcut: sc(MOD, "."),
        run: (v) => {
          wrapSelection(v, "#super[", "]");
        },
      },
    ],
  },
  {
    items: [
      {
        icon: () => <TbOutlineList />,
        label: "Bullet list",
        shortcut: sc(MOD, SHIFT, "8"),
        run: (v) => {
          togglePrefix(v, "- ", LIST_GROUP);
        },
      },
      {
        icon: () => <TbOutlineListNumbers />,
        label: "Numbered list",
        shortcut: sc(MOD, SHIFT, "7"),
        run: (v) => {
          togglePrefix(v, "+ ", LIST_GROUP);
        },
      },
    ],
  },
  {
    items: [
      {
        icon: () => <TbOutlineLink />,
        label: "Link",
        shortcut: sc(MOD, "K"),
        run: insertLink,
      },
    ],
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
                  title={`${action.label} (${action.shortcut})`}
                  aria-label={action.label}
                  aria-keyshortcuts={action.shortcut}
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
