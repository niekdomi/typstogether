import { WebSocketStatus } from "@hocuspocus/provider";
import { A, useParams } from "@solidjs/router";
import { Match, Switch } from "solid-js";

import CodeMirrorEditor from "../components/editor/CodeMirrorEditor";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useCollabDoc } from "../lib/collab/use-collab-doc";
import { useProject } from "../lib/use-project";

function statusLabel(status: WebSocketStatus, synced: boolean, readOnly: boolean): string {
  if (readOnly) return "Read-only";
  if (status === WebSocketStatus.Connected) return synced ? "Connected" : "Syncing…";
  if (status === WebSocketStatus.Connecting) return "Connecting…";
  return "Disconnected";
}

export default function Project() {
  const params = useParams<{ id: string }>();
  const project = useProject(() => params.id);
  const collab = useCollabDoc(() => params.id);

  const isReadOnly = () => project()?.role === "viewer" || collab.readOnly();

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
        <span class="font-mono text-xs text-muted-foreground">
          {statusLabel(collab.status(), collab.synced(), isReadOnly())}
        </span>
      </header>

      <main class="min-h-0 flex-1">
        <Switch>
          <Match when={project.error !== undefined}>
            <div class="p-6">
              <Alert variant="destructive">
                <AlertDescription>Could not load this project.</AlertDescription>
              </Alert>
            </div>
          </Match>
          <Match when={collab.error()}>
            {(reason) => (
              <div class="p-6">
                <Alert variant="destructive">
                  <AlertDescription>Collaboration error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={collab.ytext()} keyed>
            {(ytext) => <CodeMirrorEditor ytext={ytext} readOnly={isReadOnly} />}
          </Match>
        </Switch>
      </main>
    </div>
  );
}
