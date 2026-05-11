import type { EditorView } from "@codemirror/view";
import { WebSocketStatus } from "@hocuspocus/provider";
import { A, useNavigate, useParams } from "@solidjs/router";
import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, createMemo, createSignal, Match, Switch } from "solid-js";
import type * as Y from "yjs";

import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "../../components/ui/sidebar";
import { Skeleton } from "../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import UserMenu from "../../components/UserMenu";
import { authClient } from "../../lib/auth";
import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { MAIN_PATH } from "../../lib/paths";
import { useProject } from "../../lib/projects/use-project";
import { renderer, useTypstProject } from "../../lib/typst/use-typst-project";
import CodeMirrorEditor from "./CodeMirrorEditor";
import EditorToolbar from "./EditorToolbar";
import FileSidebar from "./file-sidebar/FileSidebar";
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
  files: Y.Map<Y.Text>;
  project: TypstProject;
}

export default function Project() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const project = useProject(() => params.id);
  const collab = useCollabDoc(() => params.id);
  const typst = useTypstProject(collab.files);

  const [requestedFile, setRequestedFile] = createSignal(MAIN_PATH);
  const [editorView, setEditorView] = createSignal<EditorView | null>(null);
  const isReadOnly = () => project()?.role === "viewer" || collab.readOnly();

  async function signOut() {
    await authClient.signOut();
    navigate("/login");
  }

  const ready = createMemo<Ready | null>(() => {
    const files = collab.files();
    const proj = typst.project();
    return files && proj ? { files, project: proj } : null;
  });

  // Active file falls back to the first available if the requested one was
  // deleted (or never existed). The signal also re-runs when files mutate via
  // collab.fileKeys() touching the dependency.
  const activeFile = createMemo(() => {
    const r = ready();
    if (!r) return MAIN_PATH;
    const requested = requestedFile();
    if (r.files.has(requested)) return requested;
    return [...r.files.keys()][0] ?? MAIN_PATH;
  });

  // Keep `requestedFile` in sync with `activeFile` so the sidebar's selection
  // reflects fallbacks (e.g. when the requested file is deleted).
  createEffect(() => {
    const a = activeFile();
    if (a !== requestedFile()) setRequestedFile(a);
  });

  const loadingLabel = () =>
    collab.files() ? "Booting Typst compiler…" : "Connecting to collab session…";

  return (
    <SidebarProvider class="flex h-screen flex-col bg-background">
      <header class="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-background px-8 py-4.5">
        <div class="flex items-center gap-4">
          <A href="/dashboard" aria-label="Back to dashboard">
            <Logo size={20} />
          </A>
          <span class="h-6 w-px bg-border/60" />
          <Switch>
            <Match when={project.loading}>
              <Skeleton class="h-5 w-48" />
            </Match>
            <Match when={project()}>
              {(m) => (
                <>
                  <h1 class="text-base font-medium">{m().project.name}</h1>
                  <Badge variant="outline">{m().role}</Badge>
                </>
              )}
            </Match>
          </Switch>
        </div>
        <div class="flex items-center gap-4.5">
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
          <UserMenu
            userName={session().data?.user.name}
            userEmail={session().data?.user.email}
            userImage={session().data?.user.image}
            onSignOut={() => void signOut()}
          />
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav
          class="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2"
          aria-label="Workspace"
        >
          <SidebarTrigger title="Toggle file explorer" aria-label="Toggle file explorer" />
        </nav>
        <Switch
          fallback={
            <div class="flex flex-1 items-center justify-center">
              <p class="text-sm text-muted-foreground">{loadingLabel()}</p>
            </div>
          }
        >
          <Match when={project.error !== undefined}>
            <div class="flex-1 p-6">
              <Alert variant="destructive">
                <AlertDescription>Could not load this project.</AlertDescription>
              </Alert>
            </div>
          </Match>
          <Match when={collab.error()}>
            {(reason) => (
              <div class="flex-1 p-6">
                <Alert variant="destructive">
                  <AlertDescription>Collaboration error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={typst.error()}>
            {(reason) => (
              <div class="flex-1 p-6">
                <Alert variant="destructive">
                  <AlertDescription>Compiler error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={ready()}>
            {(r) => (
              <>
                <FileSidebar
                  files={r().files}
                  activeFile={activeFile}
                  setActiveFile={setRequestedFile}
                />
                <main class="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 divide-x divide-border/60">
                  <div class="flex min-w-0 flex-col">
                    <EditorToolbar view={editorView} readOnly={isReadOnly} />
                    <div class="min-h-0 flex-1">
                      <CodeMirrorEditor
                        files={r().files}
                        activeFile={activeFile}
                        project={r().project}
                        readOnly={isReadOnly}
                        viewRef={setEditorView}
                      />
                    </div>
                  </div>
                  <div class="min-w-0">
                    <PreviewPane project={r().project} renderer={renderer} />
                  </div>
                </main>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </SidebarProvider>
  );
}
