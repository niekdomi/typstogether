import type { EditorView } from "@codemirror/view";
import {
  TbOutlineBold,
  TbOutlineChevronDown,
  TbOutlineCode,
  TbOutlineFrame,
  TbOutlineMath,
  TbOutlineH1,
  TbOutlineH2,
  TbOutlineH3,
  TbOutlineHeading,
  TbOutlineItalic,
  TbOutlineLink,
  TbOutlineList,
  TbOutlineListNumbers,
  TbOutlinePageBreak,
  TbOutlinePhoto,
  TbOutlinePlus,
  TbOutlineStrikethrough,
  TbOutlineSubscript,
  TbOutlineSuperscript,
  TbOutlineTable,
  TbOutlineUnderline,
} from "solid-icons/tb";
import { createSignal, For, type JSX, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  HEADING_GROUP,
  insertFigure,
  insertImage,
  insertLink,
  insertPageBreak,
  insertTable,
  LIST_GROUP,
  toggleCode,
  toggleMath,
  togglePrefix,
  wrapSelection,
} from "./editor-actions";
import { useProjectContext } from "./ProjectContext";

interface ToolbarAction {
  icon: () => JSX.Element;
  label: string;
  /** Optional, omit for actions that aren't bound to a keymap. */
  shortcut?: string;
  run: (view: EditorView) => void;
}

// Display the format-keymap shortcuts in the OS-native style.
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const SHIFT = IS_MAC ? "⇧" : "Shift";
const ALT = IS_MAC ? "⌥" : "Alt";
const SEP = IS_MAC ? "" : "+";
const sc = (...parts: string[]) => parts.join(SEP);

const headingItems: ToolbarAction[] = [
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
];

// Inline formatting stays flat, high-frequency actions worth keeping one click away.
const inlineFormat: ToolbarAction[] = [
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
    icon: () => <TbOutlineUnderline />,
    label: "Underline",
    shortcut: sc(MOD, "U"),
    run: (v) => {
      wrapSelection(v, "#underline[", "]");
    },
  },
  {
    icon: () => <TbOutlineCode />,
    label: "Code",
    shortcut: sc(MOD, "E"),
    run: (v) => {
      toggleCode(v);
    },
  },
];

const mathItems: ToolbarAction[] = [
  {
    icon: () => <TbOutlineMath />,
    label: "Math",
    shortcut: sc(MOD, "M"),
    run: (v) => {
      toggleMath(v);
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
];

const listItems: ToolbarAction[] = [
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
];

const linkAction: ToolbarAction = {
  icon: () => <TbOutlineLink />,
  label: "Link",
  shortcut: sc(MOD, "K"),
  run: insertLink,
};

const snippetItems: ToolbarAction[] = [
  {
    icon: () => <TbOutlinePhoto />,
    label: "Image",
    run: insertImage,
  },
  {
    icon: () => <TbOutlineFrame />,
    label: "Figure",
    run: insertFigure,
  },
];

const pageBreakAction: ToolbarAction = {
  icon: () => <TbOutlinePageBreak />,
  label: "Page break",
  run: insertPageBreak,
};

function Divider() {
  return <div class="bg-border/60 mx-1 h-5 w-px" />;
}

interface ActionButtonProps {
  action: ToolbarAction;
  onRun: (action: ToolbarAction) => void;
  disabled: boolean;
}

function ActionButton(props: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={
        props.action.shortcut
          ? `${props.action.label} (${props.action.shortcut})`
          : props.action.label
      }
      aria-label={props.action.label}
      aria-keyshortcuts={props.action.shortcut}
      disabled={props.disabled}
      onClick={() => {
        props.onRun(props.action);
      }}
    >
      {props.action.icon()}
    </Button>
  );
}

interface ActionMenuProps {
  label: string;
  trigger: () => JSX.Element;
  items: ToolbarAction[];
  onRun: (action: ToolbarAction) => void;
  disabled: boolean;
}

function ActionMenu(props: ActionMenuProps) {
  return (
    <DropdownMenu placement="bottom-start" gutter={4}>
      <DropdownMenuTrigger
        as={Button<"button">}
        variant="ghost"
        size="sm"
        class="h-8 gap-0.5 px-1.5"
        title={props.label}
        aria-label={props.label}
        disabled={props.disabled}
      >
        {props.trigger()}
        <TbOutlineChevronDown size={12} class="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent class="min-w-44">
        <For each={props.items}>
          {(item) => (
            <DropdownMenuItem
              onSelect={() => {
                props.onRun(item);
              }}
            >
              {item.icon()}
              <span class="flex-1">{item.label}</span>
              <Show when={item.shortcut}>
                {(s) => <DropdownMenuShortcut>{s()}</DropdownMenuShortcut>}
              </Show>
            </DropdownMenuItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TABLE_PICKER_MAX_SIZE = 8;

interface TablePickerProps {
  disabled: boolean;
  onPick: (cols: number, rows: number) => void;
}

function TablePicker(props: TablePickerProps) {
  const [open, setOpen] = createSignal(false);
  const [hoverCols, setHoverCols] = createSignal(0);
  const [hoverRows, setHoverRows] = createSignal(0);

  const reset = () => {
    setHoverCols(0);
    setHoverRows(0);
  };

  const cells = Array.from({ length: TABLE_PICKER_MAX_SIZE * TABLE_PICKER_MAX_SIZE }, (_, i) => i);

  return (
    <DropdownMenu
      placement="bottom-start"
      gutter={4}
      open={open()}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DropdownMenuTrigger
        as={Button<"button">}
        variant="ghost"
        size="sm"
        class="h-8 gap-0.5 px-1.5"
        title="Insert table"
        aria-label="Insert table"
        disabled={props.disabled}
      >
        <TbOutlineTable />
        <TbOutlineChevronDown size={12} class="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent class="p-2">
        <div class="grid grid-cols-8 gap-0.5" onMouseLeave={reset}>
          <For each={cells}>
            {(i) => {
              const col = i % TABLE_PICKER_MAX_SIZE;
              const row = Math.floor(i / TABLE_PICKER_MAX_SIZE);
              const active = () => col < hoverCols() && row < hoverRows();
              return (
                <button
                  type="button"
                  class={
                    active()
                      ? "bg-primary border-primary size-4 rounded-sm border"
                      : "bg-background border-border size-4 rounded-sm border"
                  }
                  onMouseEnter={() => {
                    setHoverCols(col + 1);
                    setHoverRows(row + 1);
                  }}
                  onClick={() => {
                    props.onPick(col + 1, row + 1);
                    setOpen(false);
                  }}
                  aria-label={`${String(col + 1)} by ${String(row + 1)} table`}
                />
              );
            }}
          </For>
        </div>
        <div class="text-muted-foreground mt-2 text-center text-xs">
          {hoverCols() > 0
            ? `${String(hoverCols())} × ${String(hoverRows())} Table`
            : "Insert table"}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function EditorToolbar() {
  const ctx = useProjectContext();
  const disabled = () => !ctx.editorView() || ctx.isReadOnly();

  const run = (action: ToolbarAction) => {
    const v = ctx.editorView();
    if (v) action.run(v);
  };

  const runInsertTable = (cols: number, rows: number) => {
    const v = ctx.editorView();
    if (v) {
      insertTable(v, cols, rows);
    }
  };

  return (
    <div class="border-border/60 flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1">
      <ActionMenu
        label="Headings"
        trigger={() => <TbOutlineHeading />}
        items={headingItems}
        onRun={run}
        disabled={disabled()}
      />
      <Divider />
      <For each={inlineFormat}>
        {(action) => <ActionButton action={action} onRun={run} disabled={disabled()} />}
      </For>
      <Divider />
      <ActionMenu
        label="Math"
        trigger={() => <TbOutlineMath />}
        items={mathItems}
        onRun={run}
        disabled={disabled()}
      />
      <ActionMenu
        label="Lists"
        trigger={() => <TbOutlineList />}
        items={listItems}
        onRun={run}
        disabled={disabled()}
      />
      <TablePicker disabled={disabled()} onPick={runInsertTable} />
      <Divider />
      <ActionMenu
        label="Insert"
        trigger={() => <TbOutlinePlus />}
        items={snippetItems}
        onRun={run}
        disabled={disabled()}
      />
      <ActionButton action={linkAction} onRun={run} disabled={disabled()} />
      <ActionButton action={pageBreakAction} onRun={run} disabled={disabled()} />
    </div>
  );
}
