import { TypstCompiler, TypstProject, TypstRenderer } from "@vedivad/codemirror-typst";
import { syncYMapToTypstProject, type TypstYjsSync } from "@vedivad/typst-web-yjs";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type * as Y from "yjs";

export const renderer = TypstRenderer.create();

export function useTypstProject(files: () => Y.Map<Y.Text> | null) {
  const [projectState, setProjectState] = createSignal<TypstProject | null>(null);
  const [errorState, setErrorState] = createSignal<string | null>(null);

  createEffect(() => {
    const f = files();
    if (!f) {
      setProjectState(null);
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
        sync = syncYMapToTypstProject({
          project: project,
          files: f,
          onError: ({ error: syncError }) => setErrorState(String(syncError)),
        });
        await sync.ready;
        if (aborted()) return;
        await project.compile();
        if (!aborted()) setProjectState(project);
      } catch (error) {
        setErrorState(String(error));
      }
    })();

    onCleanup(() => {
      aborter.abort();
      sync?.dispose();
      project?.destroy();
      setProjectState(null);
    });
  });

  return { project: projectState, error: errorState };
}
