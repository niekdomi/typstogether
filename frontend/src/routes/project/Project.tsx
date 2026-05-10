import { WebSocketStatus } from "@hocuspocus/provider";
import { A, useParams } from "@solidjs/router";
import type { TypstProject } from "@vedivad/codemirror-typst";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import type * as Y from "yjs";

import ThemeToggle from "../../components/ThemeToggle";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "../../components/ui/sidebar";
import { Skeleton } from "../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { MAIN_FILE } from "../../lib/paths";
import { useProject } from "../../lib/projects/use-project";
import { renderer, useTypstProject } from "../../lib/typst/use-typst-project";
import CodeMirrorEditor from "./CodeMirrorEditor";
import FileSidebar from "./FileSidebar";
import PreviewPane from "./PreviewPane";

interface StatusInfo {
  label: string;
  color: string;
}

function statusInfo(status: WebSocketStatus, synced: boolean, readOnly: boolean): StatusInfo {
  if (readOnly) return { label: "Read-only", color: "bg-muted-foreground" };
  if (status === WebSocketStatus.Connected)
    return synced
      ? { label: "Connected", color: "bg-green-500" }
      : { label: "Syncing…", color: "bg-yellow-500" };
  if (status === WebSocketStatus.Connecting)
    return { label: "Connecting…", color: "bg-yellow-500" };
  return { label: "Disconnected", color: "bg-red-500" };
}

interface Ready {
  ydoc: Y.Doc;
  project: TypstProject;
}

export default function Project() {
  const params = useParams<{ id: string }>();
  const project = useProject(() => params.id);
  const collab = useCollabDoc(() => params.id);
  const typst = useTypstProject(collab.ytext);

  const [activeFile, setActiveFile] = createSignal(MAIN_FILE);
  const isReadOnly = () => project()?.role === "viewer" || collab.readOnly();

  const ready = createMemo<Ready | null>(() => {
    const doc = collab.ydoc();
    const proj = typst.project();
    return doc && proj ? { ydoc: doc, project: proj } : null;
  });

  const loadingLabel = () =>
    collab.ytext() ? "Booting Typst compiler…" : "Connecting to collab session…";

  return (
    <SidebarProvider class="flex h-screen flex-col bg-background">
      <header class="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div class="flex items-center gap-3">
          <A
            href="/dashboard"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Dashboard
          </A>
          <SidebarTrigger />
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
          <Tooltip>
            <TooltipTrigger as="span" class="flex items-center">
              <span
                class={`size-2 rounded-full ${statusInfo(collab.status(), collab.synced(), isReadOnly()).color}`}
              />
            </TooltipTrigger>
            <TooltipContent>
              {statusInfo(collab.status(), collab.synced(), isReadOnly()).label}
            </TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <FileSidebar activeFile={activeFile} setActiveFile={setActiveFile} />
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
                    <Show when={activeFile()} keyed>
                      {(file) => (
                        <CodeMirrorEditor
                          ytext={r().ydoc.getText(file)}
                          path={`/${file}`}
                          project={r().project}
                          readOnly={isReadOnly}
                        />
                      )}
                    </Show>
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
    </SidebarProvider>
  );
}
