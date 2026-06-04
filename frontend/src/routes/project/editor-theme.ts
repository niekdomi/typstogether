import { EditorView } from "@codemirror/view";
import {
  atomone,
  atomoneDarkStyle,
  defaultSettingsAtomone,
  defaultSettingsDracula,
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  defaultSettingsGruvboxDark,
  defaultSettingsMaterialDark,
  defaultSettingsMaterialLight,
  defaultSettingsMonokai,
  defaultSettingsNord,
  defaultSettingsSolarizedDark,
  defaultSettingsSolarizedLight,
  dracula,
  draculaDarkStyle,
  githubDark,
  githubDarkStyle,
  githubLight,
  githubLightStyle,
  gruvboxDark,
  gruvboxDarkStyle,
  materialDark,
  materialDarkStyle,
  materialLight,
  materialLightStyle,
  monokai,
  monokaiDarkStyle,
  nord,
  nordDarkStyle,
  solarizedDark,
  solarizedDarkStyle,
  solarizedLight,
  solarizedLightStyle,
} from "@uiw/codemirror-themes-all";
import {
  type TokenTheme,
  tokenThemeFromHighlightStyle,
  type TypstThemeSpec,
  typstThemes,
} from "@vedivad/codemirror-typst";

// The editor theme registry. Each entry is the editor chrome + Typst token
// colors (bridged via typstTheme), the app light/dark polarity, and the theme's
// base surface/text colors. The app chrome is recolored generically from `base`
// (see styles.css + applyAppTheme), so the whole UI follows the editor theme
// without per-theme app tokens. Add a theme here and it shows up in the picker.
export interface AppBase {
  bg: string;
  fg: string;
  dark: boolean;
}

interface EditorThemeEntry {
  label: string;
  dark: boolean;
  spec: TypstThemeSpec;
  base: { bg: string; fg: string };
}

// @uiw's Settings type marks background/foreground optional; every theme we use
// sets both, so fall back to plain black/white only to satisfy the type. `fg`
// overrides the chrome foreground when a theme's editor body text is too low
// contrast for UI (Solarized ships its muted base color as foreground).
const base = (s: { background?: string; foreground?: string }, fg?: string) => ({
  bg: s.background ?? "#ffffff",
  fg: fg ?? s.foreground ?? "#000000",
});

// Bridge a CodeMirror highlight style to Typst `typ-*` colors, then guarantee an
// emphasis baseline: `*strong*` is bold, `_emph_` italic, headings bold, exactly
// how Typst renders them (and what typst.app's editor shows). Code themes like
// Dracula don't style markup tags at all, so without this a heading reads as
// plain prose. The theme's own color (when it defines one) layers on top.
const buildTokens = (style: Parameters<typeof tokenThemeFromHighlightStyle>[0]): TokenTheme => {
  const t = tokenThemeFromHighlightStyle(style);
  // Math delimiters/operators map to tags.bracket/operator, which most code
  // themes leave unstyled, so a `$ ... $` reads as plain prose. Fall them back to
  // the theme's own operator (else keyword) color so math is framed, like
  // typst.app. Themes that do style them (GitHub's brackets) keep their choice.
  const mathColor =
    t[".typ-math-op"]?.["color"] ?? t[".typ-op"]?.["color"] ?? t[".typ-key"]?.["color"];
  const math = mathColor ? { color: mathColor } : undefined;
  return {
    ...t,
    ".typ-strong": { fontWeight: "bold", ...t[".typ-strong"] },
    ".typ-emph": { fontStyle: "italic", ...t[".typ-emph"] },
    ".typ-heading": { fontWeight: "bold", ...t[".typ-heading"] },
    ".typ-math-delim": { ...math, ...t[".typ-math-delim"] },
    ".typ-math-op": { ...math, ...t[".typ-math-op"] },
  };
};

export const EDITOR_THEMES = {
  "github-light": {
    label: "GitHub Light",
    dark: false,
    spec: { editor: githubLight, tokens: buildTokens(githubLightStyle) },
    base: base(defaultSettingsGithubLight),
  },
  "github-dark": {
    label: "GitHub Dark",
    dark: true,
    spec: { editor: githubDark, tokens: buildTokens(githubDarkStyle) },
    base: base(defaultSettingsGithubDark),
  },
  dracula: {
    label: "Dracula",
    dark: true,
    spec: { editor: dracula, tokens: buildTokens(draculaDarkStyle) },
    base: base(defaultSettingsDracula),
  },
  nord: {
    label: "Nord",
    dark: true,
    spec: { editor: nord, tokens: buildTokens(nordDarkStyle) },
    base: base(defaultSettingsNord),
  },
  "solarized-light": {
    label: "Solarized Light",
    dark: false,
    spec: { editor: solarizedLight, tokens: buildTokens(solarizedLightStyle) },
    // base01 instead of base00: readable on the cream background.
    base: base(defaultSettingsSolarizedLight, "#586E75"),
  },
  "solarized-dark": {
    label: "Solarized Dark",
    dark: true,
    spec: { editor: solarizedDark, tokens: buildTokens(solarizedDarkStyle) },
    // base1 instead of base0: readable on the dark teal background.
    base: base(defaultSettingsSolarizedDark, "#93A1A1"),
  },
  "one-dark": {
    label: "One Dark",
    dark: true,
    spec: { editor: atomone, tokens: buildTokens(atomoneDarkStyle) },
    base: base(defaultSettingsAtomone),
  },
  monokai: {
    label: "Monokai",
    dark: true,
    spec: { editor: monokai, tokens: buildTokens(monokaiDarkStyle) },
    base: base(defaultSettingsMonokai),
  },
  "gruvbox-dark": {
    label: "Gruvbox Dark",
    dark: true,
    spec: { editor: gruvboxDark, tokens: buildTokens(gruvboxDarkStyle) },
    base: base(defaultSettingsGruvboxDark),
  },
  "material-dark": {
    label: "Material Dark",
    dark: true,
    spec: { editor: materialDark, tokens: buildTokens(materialDarkStyle) },
    base: base(defaultSettingsMaterialDark),
  },
  "material-light": {
    label: "Material Light",
    dark: false,
    spec: { editor: materialLight, tokens: buildTokens(materialLightStyle) },
    // Material's body text is a muted blue-gray; too low contrast for UI chrome.
    base: base(defaultSettingsMaterialLight, "#37474F"),
  },
} satisfies Record<string, EditorThemeEntry>;

export type EditorThemeKey = keyof typeof EDITOR_THEMES;
export const EDITOR_THEME_KEYS = Object.keys(EDITOR_THEMES) as EditorThemeKey[];
export const DEFAULT_EDITOR_THEME: EditorThemeKey = "github-dark";
export const isDarkTheme = (key: EditorThemeKey): boolean => EDITOR_THEMES[key].dark;

// The theme's base surface/text colors plus polarity, for recoloring the app.
export const appBaseFor = (key: EditorThemeKey): AppBase => {
  const t = EDITOR_THEMES[key];
  return { bg: t.base.bg, fg: t.base.fg, dark: t.dark };
};

// The theme's Typst token colors as a `.typ-*` -> CSS map, for coloring the
// static highlighted example in the theme picker preview. Same tokens the editor
// uses (buildTokens output), so the preview and editor stay identical.
export const tokenThemeFor = (key: EditorThemeKey): TokenTheme => EDITOR_THEMES[key].spec.tokens;

// Switchable theming for one editor: the whole registry behind one compartment,
// with `set(view, key)` to swap live. Highlighting decorations come from
// createTypstSetup; this only carries the theme.
export const createEditorTheming = (initial: EditorThemeKey) => {
  const specs = {} as Record<EditorThemeKey, TypstThemeSpec>;
  for (const key of EDITOR_THEME_KEYS) specs[key] = EDITOR_THEMES[key].spec;
  return typstThemes(specs, initial);
};

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
