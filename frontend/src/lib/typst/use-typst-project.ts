import { TypstCompiler, TypstProject, TypstRenderer } from "@vedivad/codemirror-typst";
import { syncYTextToTypstProject, type TypstYjsSync } from "@vedivad/typst-web-yjs";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type * as Y from "yjs";

import { MAIN_PATH } from "../paths";

export const renderer = TypstRenderer.create();

export function useTypstProject(ytext: () => Y.Text | null) {
  const [project, setProject] = createSignal<TypstProject | null>(null);
  const [errorState, setErrorState] = createSignal<string | null>(null);

  createEffect(() => {
    const t = ytext();
    if (!t) {
      setProject(null);
      return;
    }

    setErrorState(null);

    const aborter = new AbortController();
    const aborted = (): boolean => aborter.signal.aborted;
    let project: TypstProject | null = null;
    let sync: TypstYjsSync | null = null;

    void (async () => {
      try {
        const compiler = await TypstCompiler.create();
        if (aborted()) {
          compiler.destroy();
          return;
        }
        project = new TypstProject({
          compiler,
          autoCompile: { debounceMs: 200, maxWaitMs: 1000 },
        });
        sync = syncYTextToTypstProject({
          project: project,
          ytext: t,
          path: MAIN_PATH,
          onError: ({ error: syncError }) => setErrorState(String(syncError)),
        });
        await sync.ready;
        if (!aborted()) setProject(project);
      } catch (error) {
        setErrorState(String(error));
      }
    })();

    onCleanup(() => {
      aborter.abort();
      sync?.dispose();
      project?.destroy();
      setProject(null);
    });
  });

  return { project, error: errorState };
}
