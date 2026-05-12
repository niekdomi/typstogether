import type { EditorView } from "@codemirror/view";
import { WebSocketStatus } from "@hocuspocus/provider";
import { A, useParams } from "@solidjs/router";
import type { DiagnosticMessage, TypstProject } from "@vedivad/codemirror-typst";
import { FaSolidChevronLeft } from "solid-icons/fa";
import { TbOutlineAlertTriangle, TbOutlineFiles } from "solid-icons/tb";
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import type * as Y from "yjs";

import ThemeToggle from "../../components/ThemeToggle";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { cx } from "../../components/ui/cva";
import { Skeleton } from "../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import UserMenu from "../../components/UserMenu";
import { useCollabDoc } from "../../lib/collab/use-collab-doc";
import { MAIN_PATH } from "../../lib/paths";
import { useProject } from "../../lib/projects/use-project";
import { renderer, useTypstProject } from "../../lib/typst/use-typst-project";
import CodeMirrorEditor from "./CodeMirrorEditor";
import DiagnosticsPanel from "./DiagnosticsPanel";
import EditorToolbar from "./EditorToolbar";
import FileSidebar from "./file-sidebar/FileSidebar";
import PreviewPane from "./PreviewPane";
import WorkspacePanel from "./WorkspacePanel";

type Panel = "files" | "diagnostics" | null;

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: JSX.Element;
  badge?: number | undefined;
}

function RailButton(props: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      class={cx(
        "relative flex size-7 items-center justify-center rounded-md transition-colors",
        props.active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      {props.icon}
      <Show when={props.badge}>
        {(n) => (
          <span class="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white">
            {n() > 99 ? "99+" : n()}
          </span>
        )}
      </Show>
    </button>
  );
}

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
  const project = useProject(() => params.id);
  const collab = useCollabDoc(() => params.id);
  const typst = useTypstProject(collab.files);

  const [requestedFile, setRequestedFile] = createSignal(MAIN_PATH);
  const [editorView, setEditorView] = createSignal<EditorView | null>(null);
  const [currentPanel, setCurrentPanel] = createSignal<Panel>("files");
  const [diagnostics, setDiagnostics] = createSignal<DiagnosticMessage[]>([]);
  const isReadOnly = () => project()?.role === "viewer" || collab.readOnly();

  const togglePanel = (p: Exclude<Panel, null>) => {
    setCurrentPanel((cur) => (cur === p ? null : p));
  };

  const errorCount = createMemo(() => diagnostics().filter((d) => d.severity === "Error").length);

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

  // Track diagnostics from each compile so the rail badge and panel stay in sync.
  createEffect(() => {
    const r = ready();
    if (!r) {
      setDiagnostics([]);
      return;
    }
    const off = r.project.onCompile((result) => {
      setDiagnostics(result.diagnostics);
    });
    onCleanup(off);
  });

  const loadingLabel = () =>
    collab.files() ? "Booting Typst compiler…" : "Connecting to collab session…";

  return (
    <div class="flex h-screen flex-col bg-background">
      <header class="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-background px-8 py-4.5">
        <div class="flex items-center gap-4">
          <A
            href="/dashboard"
            aria-label="Back to dashboard"
            class="text-muted-foreground hover:text-foreground transition-colors"
          >
            <FaSolidChevronLeft />
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
          <UserMenu />
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav
          class="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2"
          aria-label="Workspace"
        >
          <RailButton
            label="File explorer"
            active={currentPanel() === "files"}
            onClick={() => {
              togglePanel("files");
            }}
            icon={<TbOutlineFiles size={16} />}
          />
          <RailButton
            label="Problems"
            active={currentPanel() === "diagnostics"}
            onClick={() => {
              togglePanel("diagnostics");
            }}
            icon={<TbOutlineAlertTriangle size={16} />}
            badge={errorCount() > 0 ? errorCount() : undefined}
          />
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
                <WorkspacePanel open={currentPanel() !== null}>
                  <div class="h-full" classList={{ hidden: currentPanel() !== "files" }}>
                    <FileSidebar
                      files={r().files}
                      activeFile={activeFile}
                      setActiveFile={setRequestedFile}
                    />
                  </div>
                  <div class="h-full" classList={{ hidden: currentPanel() !== "diagnostics" }}>
                    <DiagnosticsPanel
                      diagnostics={diagnostics}
                      setActiveFile={setRequestedFile}
                      view={editorView}
                    />
                  </div>
                </WorkspacePanel>
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
    </div>
  );
}
