import { TypstProject } from "@vedivad/codemirror-typst";
import { syncYMapToTypstProject, type TypstYjsSync } from "@vedivad/typst-web-yjs";
import { createEffect, onCleanup, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import type * as Y from "yjs";

interface TypstState {
  project: TypstProject | null;
  error: string | null;
}

export function useTypstProject(files: () => Y.Map<Y.Text> | null, entry: () => string) {
  const [state, setState] = createStore<TypstState>({ project: null, error: null });

  createEffect(() => {
    const f = files();
    if (!f) {
      setState("project", null);
      return;
    }

    setState("error", null);

    const aborter = new AbortController();
    const aborted = (): boolean => aborter.signal.aborted;
    let project: TypstProject | null = null;
    let sync: TypstYjsSync | null = null;

    void (async () => {
      try {
        project = await TypstProject.create({
          // This effect should rebuild only when `files` changes. Entry
          // changes (e.g. the preview eye) are applied by the effect below
          // without rebuilding the worker.
          entry: untrack(entry),
          autoCompile: { debounceMs: 200, maxWaitMs: 1000 },
        });

        if (aborted()) {
          project.destroy();
          return;
        }

        sync = syncYMapToTypstProject({
          project: project,
          files: f,
          onError: ({ error: syncError }) => {
            setState("error", String(syncError));
          },
        });
        await sync.ready;

        if (aborted()) return;
        await project.compile();
        if (!aborted()) {
          setState("project", project);
        }
      } catch (error) {
        setState("error", String(error));
      }
    })();

    onCleanup(() => {
      aborter.abort();
      sync?.dispose();
      project?.destroy();
      setState("project", null);
    });
  });

  // Re-apply the entry on change without rebuilding the compiler.
  createEffect(() => {
    const p = state.project;
    if (p) p.entry = entry();
  });

  return state;
}
