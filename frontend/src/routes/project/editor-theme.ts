import { EditorView } from "@codemirror/view";
import type { ColorMode as Theme } from "@kobalte/core/color-mode";
import {
  githubDark,
  githubDarkStyle,
  githubLight,
  githubLightStyle,
} from "@uiw/codemirror-theme-github";
import { typstThemes } from "@vedivad/codemirror-typst";

// GitHub light/dark for the editor: chrome plus Typst token colors bridged from
// the same GitHub HighlightStyle. Built per editor mount; spread the returned
// `.extension` into the editor (via createTypstSetup's `theme`) and call
// `.set(view, mode)` on color-mode change. Highlighting decorations themselves
// come from createTypstSetup; this only carries the theme.
export const createEditorTheming = (initial: Theme) =>
  typstThemes(
    {
      light: { editor: githubLight, tokens: githubLightStyle },
      dark: { editor: githubDark, tokens: githubDarkStyle },
    },
    initial
  );

export const fillHeight = EditorView.theme({
  "&": { height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
  // NOTE: Without this, the label on the first visible line is clipped by the editor toolbar.
  ".cm-content": { paddingTop: "0.75em" },
});

// Unify autocomplete / hover / lint popups with the app's popover styling.
export const popupTheme = EditorView.theme({
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
    borderRadius: "calc(var(--radius) - 2px)",
    boxShadow: "0 4px 12px -2px oklch(0 0 0 / 12%), 0 2px 4px -1px oklch(0 0 0 / 8%)",
    fontFamily: "var(--sans)",
    fontSize: "13px",
    overflow: "hidden",
  },
  ".cm-tooltip-arrow:before, .cm-tooltip-arrow:after": { display: "none" },

  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--mono)",
    fontSize: "12.5px",
    maxHeight: "16rem",
    padding: "4px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 8px",
    borderRadius: "calc(var(--radius) - 4px)",
    lineHeight: "1.4",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionLabel": { color: "inherit" },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    color: "var(--brand)",
    fontWeight: "600",
  },
  ".cm-completionDetail": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
    marginLeft: "auto",
    paddingLeft: "12px",
  },
  ".cm-completionIcon": { opacity: "0.7", paddingRight: "0" },
  ".cm-completionInfo": {
    marginLeft: "6px",
    padding: "8px 10px",
    maxWidth: "28rem",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
    borderRadius: "calc(var(--radius) - 2px)",
    boxShadow: "0 4px 12px -2px oklch(0 0 0 / 12%), 0 2px 4px -1px oklch(0 0 0 / 8%)",
  },

  ".cm-tooltip.cm-tooltip-hover, .cm-tooltip-section": { padding: "0" },
  ".cm-tooltip-hover > div, .cm-tooltip-section > div": { padding: "8px 10px" },
  ".cm-tooltip-hover p, .cm-tooltip-section p": { margin: "0 0 6px" },
  ".cm-tooltip-hover p:last-child, .cm-tooltip-section p:last-child": { marginBottom: "0" },
  ".cm-tooltip-hover code, .cm-tooltip-section code": {
    fontFamily: "var(--mono)",
    fontSize: "12px",
    padding: "1px 4px",
    borderRadius: "4px",
    backgroundColor: "var(--muted)",
  },

  // Typst hover popup (custom DOM from @vedivad/codemirror-typst): a container
  // with either a plain-text description or a syntax-highlighted code snippet.
  // Token colors inside the snippet come from the editor's typstTheme via the
  // typ-* cascade. Container padding comes from `.cm-tooltip-hover > div` above.
  ".cm-typst-hover": { maxWidth: "32rem" },
  ".cm-typst-hover-code": {
    // Bleed past the container padding so the muted code box fills the popup.
    margin: "-8px -10px",
    padding: "8px 10px",
    backgroundColor: "var(--muted)",
    fontFamily: "var(--mono)",
    fontSize: "12px",
    overflowX: "auto",
  },

  ".cm-ySelectionInfo": {
    fontFamily: "var(--sans)",
    fontWeight: "500",
    borderRadius: "3px",
    padding: "1px 5px",
  },

  ".cm-diagnostic": {
    padding: "8px 10px",
    borderLeft: "3px solid var(--border)",
    fontSize: "12.5px",
  },
  ".cm-diagnostic-error": { borderLeftColor: "var(--destructive)" },
  ".cm-diagnostic-warning": { borderLeftColor: "oklch(0.78 0.16 85)" },
  ".cm-diagnostic-info": { borderLeftColor: "var(--brand)" },
});
