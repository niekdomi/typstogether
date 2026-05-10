import type { TypstProject, TypstRenderer } from "@vedivad/codemirror-typst";
import type { RenderedSvgPage } from "@vedivad/typst-web-service";
import { createEffect, createSignal, For, Match, onCleanup, Switch } from "solid-js";

import { theme } from "../../lib/theme";

interface Props {
  project: TypstProject;
  renderer: TypstRenderer;
}

export default function PreviewPane(props: Props) {
  const [pages, setPages] = createSignal<RenderedSvgPage[] | null>(null);
  const [errorState, setErrorState] = createSignal<string | null>(null);

  createEffect(() => {
    const project = props.project;
    const renderer = props.renderer;

    const off = project.onCompile((result) => {
      const vector = result.vector;
      if (!vector) {
        setErrorState(result.diagnostics.find((d) => d.severity === "Error")?.message ?? null);
        return;
      }
      void (async () => {
        try {
          setPages(await renderer.renderSvgPages(vector));
          setErrorState(null);
        } catch (error) {
          setErrorState(String(error));
        }
      })();
    });

    onCleanup(off);
  });

  return (
    <div class="h-full w-full overflow-auto bg-muted/40 p-6">
      <Switch fallback={<p class="text-sm text-muted-foreground">Compiling…</p>}>
        <Match when={pages()}>
          {(p) => (
            <div
              class="mx-auto flex max-w-175 flex-col items-center gap-6"
              style={theme() === "dark" ? { filter: "invert(0.85) hue-rotate(180deg)" } : undefined}
            >
              <For each={p()}>
                {(page) => (
                  <div
                    class="w-full bg-white shadow-md ring-1 ring-black/10 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                    innerHTML={page.svg}
                  />
                )}
              </For>
            </div>
          )}
        </Match>
        <Match when={errorState()}>
          {(reason) => (
            <pre class="whitespace-pre-wrap font-mono text-sm text-destructive">{reason()}</pre>
          )}
        </Match>
      </Switch>
    </div>
  );
}
