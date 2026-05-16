import {
  TypstAnalyzer,
  TypstCompiler,
  TypstProject,
  TypstRenderer,
} from "@vedivad/codemirror-typst";
import { syncYMapToTypstProject, type TypstYjsSync } from "@vedivad/typst-web-yjs";
import { createEffect, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import tinymistWasmUrl from "tinymist-web/pkg/tinymist_bg.wasm?url";
import type * as Y from "yjs";

export const renderer = TypstRenderer.create();

interface TypstState {
  project: TypstProject | null;
  error: string | null;
}

export function useTypstProject(files: () => Y.Map<Y.Text> | null) {
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
        const [compiler, analyzer] = await Promise.all([
          TypstCompiler.create(),
          TypstAnalyzer.create({ wasmUrl: tinymistWasmUrl }),
        ]);

        if (aborted()) {
          compiler.destroy();
          analyzer.destroy();
          return;
        }

        project = new TypstProject({
          compiler,
          analyzer,
          autoCompile: { debounceMs: 200, maxWaitMs: 1000 },
        });

        // Plugin types `files` as `Y.Map<Y.Text | Uint8Array>` but we only
        // store `Y.Text` values. Y.Map is invariant in TS strict mode, so the
        // narrow -> wide assignment fails. Cast through `unknown` to bypass.
        const widenedFiles = f as unknown as Y.Map<Y.Text | Uint8Array>;
        sync = syncYMapToTypstProject({
          project: project,
          files: widenedFiles,
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

  return state;
}
