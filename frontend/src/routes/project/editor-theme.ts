import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  defaultSettingsDracula,
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  defaultSettingsNord,
  defaultSettingsVscodeLight,
  defaultSettingsVscodeDark,
  dracula,
  draculaDarkStyle,
  githubDark,
  githubDarkStyle,
  githubLight,
  githubLightStyle,
  nord,
  nordDarkStyle,
  vscodeLight,
  vscodeLightStyle,
  vscodeDark,
  vscodeDarkStyle,
} from "@uiw/codemirror-themes-all";
import {
  type TokenTheme,
  tokenThemeFromHighlightStyle,
  typstThemes,
} from "@vedivad/codemirror-typst";

// Theme registry. App chrome is recolored from each entry's `base` (see
// styles.css + App's root effect), so the whole UI follows the editor theme. Add an
// entry to add a picker option.
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

// Bridge a highlight style to Typst `typ-*` colors, forcing an emphasis baseline
// (strong bold, emph italic, heading bold) since code themes like Dracula don't
// style markup tags. The theme's own color layers on top.
type HighlightStyle = Parameters<typeof tokenThemeFromHighlightStyle>[0];
const buildTokens = (style: HighlightStyle): TokenTheme => {
  const t = tokenThemeFromHighlightStyle(style);
  // Frame math in the keyword color so `$ ... $` reads as an accent: some themes
  // (VS Code) paint math like plain text, and the keyword color is always distinct.
  const key = t[".typ-key"]?.["color"];
  const math: Record<string, string> = key ? { color: key } : {};
  return {
    ...t,
    ".typ-strong": { fontWeight: "bold", ...t[".typ-strong"] },
    ".typ-emph": { fontStyle: "italic", ...t[".typ-emph"] },
    ".typ-heading": { fontWeight: "bold", ...t[".typ-heading"] },
    ".typ-math-delim": { ...t[".typ-math-delim"], ...math },
    ".typ-math-op": { ...t[".typ-math-op"], ...math },
  };
};

const defineTheme = (
  label: string,
  dark: boolean,
  editor: Extension,
  style: HighlightStyle,
  settings: { background?: string; foreground?: string }
): EditorThemeEntry => {
  // App chrome text is plain white/black by polarity, not the theme's possibly
  // tinted code-text color. The bg fallback only satisfies @uiw's optional type.
  const bg = settings.background ?? (dark ? "#000000" : "#ffffff");
  const fg = dark ? "#ffffff" : "#000000";
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
  "vscode-light": defineTheme(
    "VS Code Light",
    false,
    vscodeLight,
    vscodeLightStyle,
    defaultSettingsVscodeLight
  ),
  "vscode-dark": defineTheme(
    "VS Code Dark",
    true,
    // @uiw tints default text blue (#9cdcfe); restore VS Code's real #d4d4d4.
    [vscodeDark, EditorView.theme({ ".cm-content": { color: "#d4d4d4" } })],
    vscodeDarkStyle,
    defaultSettingsVscodeDark
  ),
  nord: defineTheme("Nord", true, nord, nordDarkStyle, defaultSettingsNord),
} satisfies Record<string, EditorThemeEntry>;

export type EditorThemeKey = keyof typeof EDITOR_THEMES;
export const EDITOR_THEME_KEYS = Object.keys(EDITOR_THEMES) as EditorThemeKey[];
export const DEFAULT_EDITOR_THEME: EditorThemeKey = "github-dark";

// Base colors and polarity for recoloring the app chrome.
export const appBaseFor = (key: EditorThemeKey): AppBase => {
  const t = EDITOR_THEMES[key];
  return { ...t.base, dark: t.dark };
};

// All theme specs behind one compartment; `set(view, key)` swaps live. Carries
// only the theme; highlighting decorations come from createTypstSetup.
export const createEditorTheming = (initial: EditorThemeKey) => {
  const specs = {} as Record<EditorThemeKey, EditorThemeEntry["spec"]>;
  for (const key of EDITOR_THEME_KEYS) specs[key] = EDITOR_THEMES[key].spec;
  return typstThemes(specs, initial);
};

// Fill the container and scroll, with the scrollbar hidden (wheel/trackpad/keys
// still scroll).
export const fillHeight = EditorView.theme({
  "&": { height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto", scrollbarWidth: "none" }, // Firefox
  ".cm-scroller::-webkit-scrollbar": { display: "none" }, // WebKit / Chromium
});

// Match popups (autocomplete/hover/lint) to the app's popover tokens so they
// follow the active theme instead of CodeMirror's defaults.
export const popupTheme = EditorView.theme({
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
    borderRadius: "calc(var(--radius) - 4px)",
    boxShadow: "0 4px 12px -2px oklch(0 0 0 / 12%), 0 2px 4px -1px oklch(0 0 0 / 8%)",
    fontFamily: "var(--sans)",
    fontSize: "13px",
    overflow: "hidden",
  },
  // Padding so hover tooltip text isn't against the border.
  ".cm-tooltip-hover": { padding: "4px 6px" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
});
