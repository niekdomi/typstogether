import type { TokenTheme } from "@vedivad/codemirror-typst";
import { TbOutlineCheck } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { editorTheme, setEditorTheme } from "../lib/editor-prefs";
import {
  appBaseFor,
  EDITOR_THEME_KEYS,
  EDITOR_THEMES,
  type EditorThemeKey,
  tokenThemeFor,
} from "../routes/project/editor-theme";
import { cx } from "./ui/cva";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface ThemePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// A representative Typst snippet, pre-highlighted into Typst's stable `typ-*`
// spans by the engine and built into nested HTML once, offline. Generated from
// the same markup-mode `highlight()` spans the editor decorates with (not the
// code-mode highlight_html), so headings, strong markup, list markers, etc.
// match the live editor. The token structure is theme independent; only the
// colors change, so the preview recolors these spans per theme with no editor
// or worker needed.
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

const PREVIEW_SCOPE = ".typst-theme-preview";

// A TokenTheme is `.typ-* -> CSS-in-JS`; emit it as CSS scoped to the preview.
const buildPreviewCss = (theme: TokenTheme): string =>
  Object.entries(theme)
    .map(([selector, decl]) => {
      const body = Object.entries(decl)
        .map(
          ([prop, value]) => `${prop.replaceAll(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value}`
        )
        .join(";");
      return `${PREVIEW_SCOPE} ${selector}{${body}}`;
    })
    .join("");

// A centered modal of theme cards over a live syntax preview. Hovering a card
// previews that theme in the snippet; clicking applies it, which (via App's root
// effect) recolors the whole app, so the dialog itself is the preview. Theme is
// a user-level pref, opened from the UserMenu.
export default function ThemePickerDialog(props: ThemePickerDialogProps) {
  const [hovered, setHovered] = createSignal<EditorThemeKey | null>(null);
  const previewKey = () => hovered() ?? editorTheme();
  const previewBase = createMemo(() => appBaseFor(previewKey()));
  const previewCss = createMemo(() => buildPreviewCss(tokenThemeFor(previewKey())));

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Theme</DialogTitle>
          <DialogDescription>
            Recolors the editor and the whole app. Hover to preview, click to apply.
          </DialogDescription>
        </DialogHeader>

        <style>{previewCss()}</style>
        <pre
          class="typst-theme-preview m-0 overflow-x-auto rounded-lg border p-4 font-mono text-[12.5px] leading-relaxed"
          style={{ "background-color": previewBase().bg, color: previewBase().fg }}
          innerHTML={PREVIEW_HTML}
        />

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
