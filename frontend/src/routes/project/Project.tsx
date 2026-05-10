import { WebSocketStatus } from "@hocuspocus/provider";
import { A, useParams } from "@solidjs/router";
import type { TypstProject } from "@vedivad/codemirror-typst";
import { createMemo, Match, Switch } from "solid-js";
import type * as Y from "yjs";

import ThemeToggle from "../../components/ThemeToggle";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { useProject } from "../../lib/projects/use-project";
import { renderer, useTypstProject } from "../../lib/typst/use-typst-project";
import CodeMirrorEditor from "./CodeMirrorEditor";
import PreviewPane from "./PreviewPane";

function statusLabel(status: WebSocketStatus, synced: boolean, readOnly: boolean): string {
  if (readOnly) return "Read-only";
  if (status === WebSocketStatus.Connected) return synced ? "Connected" : "Syncing…";
  if (status === WebSocketStatus.Connecting) return "Connecting…";
  return "Disconnected";
}

interface Ready {
  ytext: Y.Text;
  project: TypstProject;
}

export default function Project() {
  const params = useParams<{ id: string }>();
  const project = useProject(() => params.id);
  const collab = useCollabDoc(() => params.id);
  const typst = useTypstProject(collab.ytext);

  const isReadOnly = () => project()?.role === "viewer" || collab.readOnly();

  const ready = createMemo<Ready | null>(() => {
    const ytext = collab.ytext();
    const proj = typst.project();
    return ytext && proj ? { ytext, project: proj } : null;
  });

  const loadingLabel = () =>
    collab.ytext() ? "Booting Typst compiler…" : "Connecting to collab session…";

  return (
    <div class="flex h-screen flex-col bg-background">
      <header class="flex items-center justify-between border-b border-border/60 px-6 py-3">
        <div class="flex items-center gap-3">
          <A
            href="/dashboard"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Dashboard
          </A>
          <Switch>
            <Match when={project.loading}>
              <Skeleton class="h-5 w-48" />
            </Match>
            <Match when={project()}>
              {(m) => (
                <>
                  <h1 class="text-lg font-medium">{m().project.name}</h1>
                  <Badge variant="outline">{m().role}</Badge>
                </>
              )}
            </Match>
          </Switch>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-xs text-muted-foreground">
            {statusLabel(collab.status(), collab.synced(), isReadOnly())}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main class="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 divide-x divide-border/60">
        <Switch
          fallback={
            <div class="col-span-2 flex items-center justify-center">
              <p class="text-sm text-muted-foreground">{loadingLabel()}</p>
            </div>
          }
        >
          <Match when={project.error !== undefined}>
            <div class="col-span-2 p-6">
              <Alert variant="destructive">
                <AlertDescription>Could not load this project.</AlertDescription>
              </Alert>
            </div>
          </Match>
          <Match when={collab.error()}>
            {(reason) => (
              <div class="col-span-2 p-6">
                <Alert variant="destructive">
                  <AlertDescription>Collaboration error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={typst.error()}>
            {(reason) => (
              <div class="col-span-2 p-6">
                <Alert variant="destructive">
                  <AlertDescription>Compiler error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={ready()}>
            {(r) => (
              <>
                <div class="min-w-0">
                  <CodeMirrorEditor ytext={r().ytext} project={r().project} readOnly={isReadOnly} />
                </div>
                <div class="min-w-0">
                  <PreviewPane project={r().project} renderer={renderer} />
                </div>
              </>
            )}
          </Match>
        </Switch>
      </main>
    </div>
  );
}
