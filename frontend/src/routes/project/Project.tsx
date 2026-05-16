import { WebSocketStatus } from "@hocuspocus/provider";
import { A } from "@solidjs/router";
import { FaSolidChevronLeft } from "solid-icons/fa";
import { TbOutlineAlertTriangle, TbOutlineFiles } from "solid-icons/tb";
import { createSignal, type JSX, Match, Show, Switch } from "solid-js";

import ThemeToggle from "../../components/ThemeToggle";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { cx } from "../../components/ui/cva";
import { Skeleton } from "../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import AssetPreview from "./AssetPreview";
import CodeMirrorEditor from "./CodeMirrorEditor";
import CollaboratorAvatars from "./CollaboratorAvatars";
import DiagnosticsPanel from "./DiagnosticsPanel";
import EditorToolbar from "./EditorToolbar";
import FileSidebar from "./file-sidebar/FileSidebar";
import PreviewPane from "./PreviewPane";
import { ProjectProvider, useProjectContext } from "./ProjectContext";
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
          <span class="bg-destructive absolute -right-1 -bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium text-white">
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

function ProjectView() {
  const ctx = useProjectContext();
  const [currentPanel, setCurrentPanel] = createSignal<Panel>("files");

  const togglePanel = (p: Exclude<Panel, null>) => {
    setCurrentPanel((cur) => (cur === p ? null : p));
  };

  const loadingLabel = () =>
    ctx.collab.files ? "Booting Typst compiler…" : "Connecting to collab session…";

  return (
    <div class="bg-background flex h-screen flex-col">
      <header class="border-border bg-background sticky top-0 z-10 flex shrink-0 items-center justify-between border-b px-8 py-4.5">
        <div class="flex items-center gap-4">
          <A
            href="/dashboard"
            aria-label="Back to dashboard"
            class="text-muted-foreground hover:text-foreground transition-colors"
          >
            <FaSolidChevronLeft />
          </A>
          <span class="bg-border/60 h-6 w-px" />
          <Switch>
            <Match when={ctx.membership.loading}>
              <Skeleton class="h-5 w-48" />
            </Match>
            <Match when={ctx.membership()}>
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
          <CollaboratorAvatars />
          <span class="h-5 w-px bg-border/60" />
          <Tooltip>
            <TooltipTrigger as="span" class="flex items-center">
              <span
                class={`size-2 rounded-full ${statusInfo(ctx.collab.status, ctx.collab.synced, ctx.isReadOnly()).color}`}
              />
            </TooltipTrigger>
            <TooltipContent>
              {statusInfo(ctx.collab.status, ctx.collab.synced, ctx.isReadOnly()).label}
            </TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav
          class="border-sidebar-border bg-sidebar flex w-10 shrink-0 flex-col items-center gap-1 border-r py-2"
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
            icon={
              <Show when={ctx.errorCount() > 0} fallback={<TbOutlineAlertTriangle size={16} />}>
                <TbOutlineAlertTriangle size={16} color="red" />
              </Show>
            }
            // NOTE: I commented this out, since it's in most cases just one, didn't add much value therefore
            // badge={ctx.errorCount() > 0 ? ctx.errorCount() : undefined}
          />
        </nav>
        <Switch
          fallback={
            <div class="flex flex-1 items-center justify-center">
              <p class="text-muted-foreground text-sm">{loadingLabel()}</p>
            </div>
          }
        >
          <Match when={ctx.membership.error !== undefined}>
            <div class="flex-1 p-6">
              <Alert variant="destructive">
                <AlertDescription>Could not load this project.</AlertDescription>
              </Alert>
            </div>
          </Match>
          <Match when={ctx.collab.error}>
            {(reason) => (
              <div class="flex-1 p-6">
                <Alert variant="destructive">
                  <AlertDescription>Collaboration error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={ctx.typst.error}>
            {(reason) => (
              <div class="flex-1 p-6">
                <Alert variant="destructive">
                  <AlertDescription>Compiler error: {reason()}</AlertDescription>
                </Alert>
              </div>
            )}
          </Match>
          <Match when={ctx.ready()}>
            <>
              <WorkspacePanel open={currentPanel() !== null}>
                <div class="h-full" classList={{ hidden: currentPanel() !== "files" }}>
                  <FileSidebar />
                </div>
                <div class="h-full" classList={{ hidden: currentPanel() !== "diagnostics" }}>
                  <DiagnosticsPanel />
                </div>
              </WorkspacePanel>
              <main class="divide-border/60 grid min-h-0 flex-1 grid-cols-2 grid-rows-1 divide-x">
                <div class="flex min-w-0 flex-col">
                  <Show when={!ctx.activeIsAsset()}>
                    <EditorToolbar />
                  </Show>
                  <div class="min-h-0 flex-1">
                    <Show when={ctx.activeIsAsset()} fallback={<CodeMirrorEditor />}>
                      <AssetPreview />
                    </Show>
                  </div>
                </div>
                <div class="min-w-0">
                  <PreviewPane />
                </div>
              </main>
            </>
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export default function Project() {
  return (
    <ProjectProvider>
      <ProjectView />
    </ProjectProvider>
  );
}
