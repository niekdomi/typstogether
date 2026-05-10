import { Compartment, EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { createTypstHighlighting } from "@vedivad/codemirror-typst";
import { basicSetup, EditorView } from "codemirror";
import { createEffect, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { theme } from "../../lib/theme";

const highlightingPromise = createTypstHighlighting({ theme: theme() });

interface Props {
  ytext: Y.Text;
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
      const undoManager = new Y.UndoManager(props.ytext);

      const view = new EditorView({
        parent,
        state: EditorState.create({
          doc: props.ytext.toJSON(),
          extensions: [
            basicSetup,
            keymap.of(yUndoManagerKeymap),
            controller.extension,
            yCollab(props.ytext, null, { undoManager }),
            readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly())),
          ],
        }),
      });

      runWithOwner(owner, () => {
        createEffect(() => {
          view.dispatch({
            effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(props.readOnly())),
          });
        });

        createEffect(() => {
          controller.setTheme(view, theme());
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
