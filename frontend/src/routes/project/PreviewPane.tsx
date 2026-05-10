import type { TypstProject, TypstRenderer } from "@vedivad/codemirror-typst";
import { createEffect, createSignal, Match, onCleanup, Switch } from "solid-js";

import { theme } from "../../lib/theme";

interface Props {
  project: TypstProject;
  renderer: TypstRenderer;
}

export default function PreviewPane(props: Props) {
  const [svg, setSvg] = createSignal<string | null>(null);
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
          setSvg(await renderer.renderSvg(vector));
          setErrorState(null);
        } catch (error) {
          setErrorState(String(error));
        }
      })();
    });

    onCleanup(off);
  });

  return (
    <div class="h-full w-full overflow-auto bg-background p-6">
      <Switch fallback={<p class="text-sm text-muted-foreground">Compiling…</p>}>
        <Match when={svg()}>
          {(s) => <div class={theme() === "dark" ? "invert hue-rotate-180" : ""} innerHTML={s()} />}
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
