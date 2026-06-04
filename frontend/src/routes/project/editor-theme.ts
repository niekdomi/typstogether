import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  defaultSettingsDracula,
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  defaultSettingsMaterialDark,
  defaultSettingsMaterialLight,
  defaultSettingsNord,
  dracula,
  draculaDarkStyle,
  githubDark,
  githubDarkStyle,
  githubLight,
  githubLightStyle,
  materialDark,
  materialDarkStyle,
  materialLight,
  materialLightStyle,
  nord,
  nordDarkStyle,
} from "@uiw/codemirror-themes-all";
import {
  type TokenTheme,
  tokenThemeFromHighlightStyle,
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
  spec: { editor: Extension; tokens: TokenTheme };
  base: { bg: string; fg: string };
}

// WCAG 2.x relative luminance + contrast ratio, used to nudge low-contrast
// theme foregrounds (e.g. Solarized's base0, Material's muted blue-gray) into
// readable territory for the app chrome without hardcoded per-theme overrides.
const parseHex = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const toHex = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
const luminance = (hex: string): number => {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};
const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

// Step `fg` toward black or white (away from `bg`'s polarity) until it meets
// `min` contrast against `bg`. Linear-RGB stepping drifts toward gray as it
// approaches the limits, which is fine for UI chrome (the editor body keeps
// the theme's own color). 4.5:1 is WCAG AA for normal text and matches the
// targets the prior hand-picked overrides hit.
const adjustForContrast = (bg: string, fg: string, min = 4.5): string => {
  if (contrastRatio(bg, fg) >= min) return fg;
  const step = luminance(bg) > 0.5 ? -4 : 4;
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  let [r, g, b] = parseHex(fg);
  for (let i = 0; i < 64; i++) {
    const [nr, ng, nb] = [clamp(r + step), clamp(g + step), clamp(b + step)];
    if (nr === r && ng === g && nb === b) break;
    [r, g, b] = [nr, ng, nb];
    if (contrastRatio(bg, toHex(r, g, b)) >= min) break;
  }
  return toHex(r, g, b);
};

// Bridge a CodeMirror highlight style to Typst `typ-*` colors, then guarantee an
// emphasis baseline: `*strong*` is bold, `_emph_` italic, headings bold, exactly
// how Typst renders them (and what typst.app's editor shows). Code themes like
// Dracula don't style markup tags at all, so without this a heading reads as
// plain prose. The theme's own color (when it defines one) layers on top.
type HighlightStyle = Parameters<typeof tokenThemeFromHighlightStyle>[0];
const buildTokens = (style: HighlightStyle): TokenTheme => {
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

const defineTheme = (
  label: string,
  dark: boolean,
  editor: Extension,
  style: HighlightStyle,
  settings: { background?: string; foreground?: string }
): EditorThemeEntry => {
  // @uiw's Settings marks both optional; the themes we use set both, so fall
  // back to plain black/white only to satisfy the type.
  const bg = settings.background ?? "#ffffff";
  const fg = adjustForContrast(bg, settings.foreground ?? "#000000");
  return { label, dark, spec: { editor, tokens: buildTokens(style) }, base: { bg, fg } };
};

export const EDITOR_THEMES = {
  "github-light": defineTheme(
    "GitHub Light",
    false,
    githubLight,
    githubLightStyle,
    defaultSettingsGithubLight
  ),
  "github-dark": defineTheme(
    "GitHub Dark",
    true,
    githubDark,
    githubDarkStyle,
    defaultSettingsGithubDark
  ),
  dracula: defineTheme("Dracula", true, dracula, draculaDarkStyle, defaultSettingsDracula),
  "material-light": defineTheme(
    "Material Light",
    false,
    materialLight,
    materialLightStyle,
    defaultSettingsMaterialLight
  ),
  "material-dark": defineTheme(
    "Material Dark",
    true,
    materialDark,
    materialDarkStyle,
    defaultSettingsMaterialDark
  ),
  nord: defineTheme("Nord", true, nord, nordDarkStyle, defaultSettingsNord),
} satisfies Record<string, EditorThemeEntry>;

export type EditorThemeKey = keyof typeof EDITOR_THEMES;
export const EDITOR_THEME_KEYS = Object.keys(EDITOR_THEMES) as EditorThemeKey[];
export const DEFAULT_EDITOR_THEME: EditorThemeKey = "github-dark";

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
  const specs = {} as Record<EditorThemeKey, EditorThemeEntry["spec"]>;
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
