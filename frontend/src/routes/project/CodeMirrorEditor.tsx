import { Compartment, type Extension, EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import {
  createTypstHighlighting,
  createTypstSetup,
  type TypstProject,
  typstFilePath,
} from "@vedivad/codemirror-typst";
import { basicSetup, EditorView } from "codemirror";
import { createEffect, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { MAIN_PATH } from "../../lib/paths";
import { theme, type Theme } from "../../lib/theme";

const highlightingPromise = createTypstHighlighting({ theme: theme() });

const editorTheme = (t: Theme): Extension => (t === "dark" ? githubDark : githubLight);

interface Props {
  ytext: Y.Text;
  project: TypstProject;
  readOnly: () => boolean;
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
      const undoManager = new Y.UndoManager(props.ytext);

      const setup = createTypstSetup({
        project: props.project,
        sync: "external",
        highlighting: controller,
      });

      const view = new EditorView({
        parent,
        state: EditorState.create({
          doc: props.ytext.toJSON(),
          extensions: [
            basicSetup,
            keymap.of(yUndoManagerKeymap),
            themeCompartment.of(editorTheme(theme())),
            ...setup,
            yCollab(props.ytext, null, { undoManager }),
            readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly())),
            typstFilePath.of(MAIN_PATH),
          ],
        }),
      });
      view.focus();

      runWithOwner(owner, () => {
        createEffect(() => {
          view.dispatch({
            effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(props.readOnly())),
          });
        });

        createEffect(() => {
          const t = theme();
          view.dispatch({
            effects: themeCompartment.reconfigure(editorTheme(t)),
          });
          controller.setTheme(view, t);
        });

        onCleanup(() => {
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
      class="h-full w-full overflow-auto"
    />
  );
}
