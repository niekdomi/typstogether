import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import {
  createTypstHighlighting,
  createTypstSetup,
  type TypstProject,
  typstFilePath,
} from "@vedivad/codemirror-typst";
import { basicSetup } from "codemirror";
import { createEffect, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { theme, type Theme } from "../../lib/theme";
import { formatKeymap } from "./editor-actions";

const highlightingPromise = createTypstHighlighting({ theme: theme() });

const editorTheme = (t: Theme): Extension => (t === "dark" ? githubDark : githubLight);

const fillHeight = EditorView.theme({
  "&": { height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
});

interface Props {
  files: Y.Map<Y.Text>;
  activeFile: () => string;
  project: TypstProject;
  readOnly: () => boolean;
  /** Called with the view after mount and with `null` on unmount. */
  viewRef?: (view: EditorView | null) => void;
}

interface PerFileState {
  state: EditorState;
  undoManager: Y.UndoManager;
}

export default function CodeMirrorEditor(props: Props) {
  let parent: HTMLDivElement | undefined;

  onMount(() => {
    const owner = getOwner();
    void (async () => {
      if (!parent || !owner) return;
      const controller = await highlightingPromise;

      const readOnlyCompartment = new Compartment();
      const themeCompartment = new Compartment();
      const setup = createTypstSetup({
        project: props.project,
        sync: "external",
        highlighting: controller,
      });

      const states = new Map<string, PerFileState>();

      const buildState = (path: string, text: Y.Text): PerFileState => {
        const undoManager = new Y.UndoManager(text);
        const state = EditorState.create({
          doc: text.toJSON(),
          extensions: [
            basicSetup,
            keymap.of(yUndoManagerKeymap),
            formatKeymap,
            fillHeight,
            themeCompartment.of(editorTheme(theme())),
            readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly())),
            ...setup,
            yCollab(text, null, { undoManager }),
            typstFilePath.of(path),
          ],
        });
        return { state, undoManager };
      };

      const ensureState = (path: string): PerFileState | null => {
        const existing = states.get(path);
        if (existing) return existing;
        const text = props.files.get(path);
        if (!text) return null;
        const built = buildState(path, text);
        states.set(path, built);
        return built;
      };

      const initialPath = props.activeFile();
      const initial = ensureState(initialPath);
      if (!initial) return;

      const view = new EditorView({ parent, state: initial.state });
      view.focus();
      props.viewRef?.(view);

      let currentPath = initialPath;

      const syncCompartments = () => {
        view.dispatch({
          effects: [
            themeCompartment.reconfigure(editorTheme(theme())),
            readOnlyCompartment.reconfigure(EditorState.readOnly.of(props.readOnly())),
          ],
        });
        controller.setTheme(view, theme());
      };

      const switchTo = (path: string) => {
        if (path === currentPath) return;
        const next = ensureState(path);
        if (!next) return;
        const current = states.get(currentPath);
        if (current) current.state = view.state;
        view.setState(next.state);
        currentPath = path;
        syncCompartments();
      };

      const observer = () => {
        // Drop states for files that no longer exist.
        for (const [path, entry] of states) {
          if (!props.files.has(path)) {
            entry.undoManager.destroy();
            states.delete(path);
          }
        }
      };
      props.files.observe(observer);

      runWithOwner(owner, () => {
        createEffect(() => {
          switchTo(props.activeFile());
        });

        createEffect(() => {
          // Touch reactive deps (theme/readOnly) so reconfigure runs on change.
          theme();
          props.readOnly();
          syncCompartments();
        });

        onCleanup(() => {
          props.viewRef?.(null);
          props.files.unobserve(observer);
          for (const entry of states.values()) entry.undoManager.destroy();
          states.clear();
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
