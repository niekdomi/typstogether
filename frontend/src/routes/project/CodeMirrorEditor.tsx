import { indentWithTab } from "@codemirror/commands";
import { Compartment, type EditorSelection, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useColorMode } from "@kobalte/core/color-mode";
import { Vim, vim } from "@replit/codemirror-vim";
import { createTypstSetup, typstFilePath } from "@vedivad/codemirror-typst";
import { createEffect, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { vimMode } from "../../lib/editor-prefs";
import { formatKeymap } from "./editor-actions";
import { editorSetup } from "./editor-setup";
import { editorTheme, fillHeight, getHighlighting, popupTheme } from "./editor-theme";
import { useProjectContext } from "./ProjectContext";

// Vim's `u` / `Ctrl-R` call `@codemirror/commands` undo/redo, which target the
// local CM history we deliberately don't load. Route them through Yjs instead.
const yjsUndo = yUndoManagerKeymap.find((b) => b.key === "Mod-z")?.run;
const yjsRedo = yUndoManagerKeymap.find((b) => b.key === "Mod-y")?.run;
if (yjsUndo && yjsRedo) {
  Vim.defineAction("undo", (cm, args) => {
    for (let i = 0; i < args.repeat; i++) yjsUndo(cm.cm6);
  });
  Vim.defineAction("redo", (cm, args) => {
    for (let i = 0; i < args.repeat; i++) yjsRedo(cm.cm6);
  });
}

interface PerFileCache {
  undoManager: Y.UndoManager;
  selection?: EditorSelection;
}

export default function CodeMirrorEditor() {
  const ctx = useProjectContext();
  const { colorMode: theme } = useColorMode();
  let parent: HTMLDivElement | undefined;

  onMount(() => {
    const owner = getOwner();
    void (async () => {
      if (!parent || !owner) return;
      // Editor only mounts inside `ctx.ready()`, so files + typst project are non-null.
      const files = ctx.collab.files!;
      const typstProject = ctx.typst.project!;
      const controller = await getHighlighting(theme());

      const readOnlyCompartment = new Compartment();
      const themeCompartment = new Compartment();
      const vimCompartment = new Compartment();
      const setup = createTypstSetup({
        project: typstProject,
        sync: "external",
        highlighting: controller,
      });
      // Per-file: undo history and last selection persist across switches. The
      // EditorState itself is rebuilt on every switch-in from text.toJSON() so
      // the doc reflects remote edits that landed while the file was inactive.
      const caches = new Map<string, PerFileCache>();

      const ensureCache = (text: Y.Text, path: string): PerFileCache => {
        const existing = caches.get(path);
        if (existing) return existing;
        const cache: PerFileCache = { undoManager: new Y.UndoManager(text) };
        caches.set(path, cache);
        return cache;
      };

      const buildState = (path: string, text: Y.Text, cache: PerFileCache): EditorState => {
        const doc = text.toJSON();
        // Clamp the saved selection to the current doc length.
        const cached = cache.selection?.main;
        const selection = cached
          ? { anchor: Math.min(cached.anchor, doc.length), head: Math.min(cached.head, doc.length) }
          : undefined;
        return EditorState.create({
          doc,
          selection,
          extensions: [
            Prec.highest(vimCompartment.of(vimMode() ? vim() : [])),
            Prec.high(formatKeymap),
            keymap.of([indentWithTab, ...yUndoManagerKeymap]),
            editorSetup,
            ...setup,
            yCollab(text, ctx.collab.awareness, { undoManager: cache.undoManager }),
            typstFilePath.of(path),
            readOnlyCompartment.of(EditorState.readOnly.of(ctx.isReadOnly())),
            themeCompartment.of(editorTheme(theme())),
            popupTheme,
            fillHeight,
          ],
        });
      };

      const buildStateForPath = (path: string): EditorState | null => {
        const text = files.get(path);
        if (!text) return null;
        return buildState(path, text, ensureCache(text, path));
      };

      const initialPath = ctx.activeFile();
      const initialState = buildStateForPath(initialPath);
      if (!initialState) return;

      const view = new EditorView({ parent, state: initialState });
      view.focus();
      ctx.setEditorView(view);

      let currentPath = initialPath;

      const syncCompartments = () => {
        view.dispatch({
          effects: [
            themeCompartment.reconfigure(editorTheme(theme())),
            readOnlyCompartment.reconfigure(EditorState.readOnly.of(ctx.isReadOnly())),
            vimCompartment.reconfigure(vimMode() ? vim() : []),
          ],
        });
        controller.setTheme(view, theme());
      };

      const switchTo = (path: string) => {
        if (path === currentPath) return;
        const nextState = buildStateForPath(path);
        if (!nextState) return;
        // Save the outgoing file's selection so the cursor restores on return.
        const outgoing = caches.get(currentPath);
        if (outgoing) outgoing.selection = view.state.selection;
        view.setState(nextState);
        currentPath = path;
        syncCompartments();
      };

      const observer = () => {
        // Drop caches for files that no longer exist.
        for (const [path, entry] of caches) {
          if (!files.has(path)) {
            entry.undoManager.destroy();
            caches.delete(path);
          }
        }
      };
      files.observe(observer);

      runWithOwner(owner, () => {
        createEffect(() => {
          switchTo(ctx.activeFile());
        });

        createEffect(() => {
          // Touch reactive deps (theme/readOnly/vim) so reconfigure runs on change.
          theme();
          ctx.isReadOnly();
          vimMode();
          syncCompartments();
        });

        onCleanup(() => {
          ctx.setEditorView(null);
          files.unobserve(observer);
          for (const entry of caches.values()) entry.undoManager.destroy();
          caches.clear();
          view.destroy();
        });
      });
    })();
  });

  return (
    <div
      ref={(el) => {
        parent = el;
      }}
      class="h-full w-full"
    />
  );
}
