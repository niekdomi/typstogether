import type { EditorView } from "@codemirror/view";
import {
  TbOutlineBold,
  TbOutlineChevronDown,
  TbOutlineCode,
  TbOutlineMath,
  TbOutlineH1,
  TbOutlineH2,
  TbOutlineH3,
  TbOutlineHeading,
  TbOutlineItalic,
  TbOutlineLink,
  TbOutlineList,
  TbOutlineListNumbers,
  TbOutlineStrikethrough,
  TbOutlineSubscript,
  TbOutlineSuperscript,
  TbOutlineUnderline,
} from "solid-icons/tb";
import { For, type JSX } from "solid-js";

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
  insertLink,
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
  shortcut: string;
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
      title={`${props.action.label} (${props.action.shortcut})`}
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
              <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </For>
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
      <Divider />
      <ActionButton action={linkAction} onRun={run} disabled={disabled()} />
    </div>
  );
}
