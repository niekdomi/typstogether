import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers } from "@codemirror/view";
import { typstTheme } from "@vedivad/codemirror-typst";
import { TbOutlineCheck } from "solid-icons/tb";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { editorTheme, setEditorTheme } from "../lib/editor-prefs";
import {
  EDITOR_THEME_KEYS,
  EDITOR_THEMES,
  type EditorThemeKey,
} from "../routes/project/editor-theme";
import { cx } from "./ui/cva";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface ThemePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// A representative Typst snippet, pre-highlighted into Typst's stable `typ-*`
// spans by the engine offline. Generated from the same markup-mode `highlight()`
// spans the editor decorates with, so the token ranges below are exactly what
// the live editor would produce, with no engine or worker needed at runtime.
const PREVIEW_HTML = `<code><span class="typ-comment">// Monthly report</span>
<span class="typ-key">#</span><span class="typ-key">set</span> <span class="typ-func">page</span><span class="typ-punct">(</span>margin<span class="typ-punct">:</span> <span class="typ-num">2cm</span><span class="typ-punct">)</span>
<span class="typ-key">#</span><span class="typ-key">set</span> <span class="typ-func">text</span><span class="typ-punct">(</span>font<span class="typ-punct">:</span> <span class="typ-str">&quot;New Computer Modern&quot;</span><span class="typ-punct">)</span>

<span class="typ-heading">= Results</span> <span class="typ-label">&lt;results&gt;</span>

We saw a <span class="typ-strong">*significant*</span> rise of 12% this month,
summarised by the table below.

<span class="typ-key">#</span><span class="typ-key">let</span> <span class="typ-func">average</span><span class="typ-punct">(</span>xs<span class="typ-punct">)</span> <span class="typ-op">=</span> xs<span class="typ-punct">.</span><span class="typ-func">sum</span><span class="typ-punct">(</span><span class="typ-punct">)</span> <span class="typ-op">/</span> xs<span class="typ-punct">.</span><span class="typ-func">len</span><span class="typ-punct">(</span><span class="typ-punct">)</span>

<span class="typ-marker">-</span> North: <span class="typ-func">#</span><span class="typ-func">average</span><span class="typ-punct">(</span><span class="typ-punct">(</span><span class="typ-num">3</span><span class="typ-punct">,</span> <span class="typ-num">5</span><span class="typ-punct">,</span> <span class="typ-num">4</span><span class="typ-punct">)</span><span class="typ-punct">)</span>
<span class="typ-marker">-</span> South: 7.2

The growth follows <span class="typ-math-delim">$</span> y = a e<span class="typ-math-op">^</span><span class="typ-punct">(</span>k t<span class="typ-punct">)</span> <span class="typ-math-delim">$</span>.
</code>`;

// Flatten the snippet HTML into plain text plus token ranges, so a real (but
// read-only) editor can render it with the same `.typ-*` decorations the live
// editor uses. The spans are flat (never nested), so a single pass over the
// `<code>` child nodes suffices.
const parsePreview = (html: string) => {
  const code = new DOMParser().parseFromString(html, "text/html").querySelector("code");
  let doc = "";
  const marks = [] as { from: number; to: number; cls: string }[];
  for (const node of code?.childNodes ?? []) {
    const text = node.textContent ?? "";
    if (node.nodeType === Node.ELEMENT_NODE && text) {
      marks.push({
        from: doc.length,
        to: doc.length + text.length,
        cls: (node as Element).className,
      });
    }
    doc += text;
  }
  return { doc, marks };
};

const { doc: SAMPLE_DOC, marks: SAMPLE_MARKS } = parsePreview(PREVIEW_HTML);
const SAMPLE_DECORATIONS = Decoration.set(
  SAMPLE_MARKS.map((m) => Decoration.mark({ class: m.cls }).range(m.from, m.to)),
  true
);

// Layout chrome shared by every preview; the per-theme colors come from the
// theme's own editor extension + token theme.
const previewLayout = EditorView.theme({
  // No height cap: the editor sizes to its content so the whole snippet shows.
  "&": { fontSize: "12.5px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--mono)", lineHeight: "1.6" },
  ".cm-content": { paddingBlock: "10px" },
});

const themeExtension = (key: EditorThemeKey): Extension => [
  EDITOR_THEMES[key].spec.editor,
  typstTheme(EDITOR_THEMES[key].spec.tokens),
];

// A real, read-only CodeMirror instance: same chrome, gutter, default text
// color, and token decorations as the editor, so the preview matches exactly.
// Hovering reconfigures the theme compartment in place.
function ThemePreview(props: { previewKey: EditorThemeKey }) {
  let host!: HTMLDivElement;
  onMount(() => {
    const themeCompartment = new Compartment();
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: SAMPLE_DOC,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          lineNumbers(),
          EditorView.decorations.of(SAMPLE_DECORATIONS),
          previewLayout,
          themeCompartment.of(themeExtension(props.previewKey)),
        ],
      }),
    });
    createEffect(() => {
      view.dispatch({ effects: themeCompartment.reconfigure(themeExtension(props.previewKey)) });
    });
    onCleanup(() => {
      view.destroy();
    });
  });
  return (
    <div
      ref={(el) => {
        host = el;
      }}
      class="overflow-hidden rounded-lg border"
    />
  );
}

// A centered modal of theme cards over a live preview. Hovering a card previews
// that theme in the snippet; clicking applies it, which (via App's root effect)
// recolors the whole app. Theme is a user-level pref, opened from the UserMenu.
export default function ThemePickerDialog(props: ThemePickerDialogProps) {
  const [hovered, setHovered] = createSignal<EditorThemeKey | null>(null);
  const previewKey = () => hovered() ?? editorTheme();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Theme</DialogTitle>
          <DialogDescription>
            Recolors the editor and the whole app. Hover to preview, click to apply.
          </DialogDescription>
        </DialogHeader>

        <ThemePreview previewKey={previewKey()} />

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <For each={EDITOR_THEME_KEYS}>
            {(key) => {
              const t = EDITOR_THEMES[key];
              const active = () => editorTheme() === key;
              return (
                <button
                  type="button"
                  onClick={() => setEditorTheme(key)}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
                  aria-pressed={active()}
                  class={cx(
                    "flex items-center gap-2 rounded-md border p-1.5 text-left transition-colors",
                    active()
                      ? "border-brand ring-brand/40 ring-1"
                      : "border-border hover:border-foreground/30"
                  )}
                >
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
                    style={{ "background-color": t.base.bg, color: t.base.fg }}
                  >
                    Aa
                  </span>
                  <span class="flex-1 truncate text-xs font-medium">{t.label}</span>
                  <Show when={active()}>
                    <TbOutlineCheck size={13} class="text-brand shrink-0" />
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </DialogContent>
    </Dialog>
  );
}
