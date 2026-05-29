import { WebSocketStatus } from "@hocuspocus/provider";
import { A } from "@solidjs/router";
import { usePanelContext } from "corvu/resizable";
import { FaSolidChevronLeft } from "solid-icons/fa";
import {
  TbOutlineAdjustmentsHorizontal,
  TbOutlineAlertTriangle,
  TbOutlineFiles,
  TbOutlineSettings,
} from "solid-icons/tb";
import { createEffect, createSignal, type JSX, Match, Show, Switch } from "solid-js";

import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { cx } from "../../components/ui/cva";
import { Resizable, ResizableHandle, ResizablePanel } from "../../components/ui/resizable";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch as SwitchInput } from "../../components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import UserMenu from "../../components/UserMenu";
import {
  relativeLineNumbers,
  setRelativeLineNumbers,
  setShowLineNumbers,
  setVimMode,
  showLineNumbers,
  vimMode,
} from "../../lib/editor-prefs";
import AssetPreview from "./AssetPreview";
import CodeMirrorEditor from "./CodeMirrorEditor";
import CollaboratorAvatars from "./CollaboratorAvatars";
import DiagnosticsPanel from "./DiagnosticsPanel";
import EditorToolbar from "./EditorToolbar";
import FileSidebar from "./file-sidebar/FileSidebar";
import PreviewPane from "./PreviewPane";
import { ProjectProvider, useProjectContext } from "./ProjectContext";
import ProjectSettingsDialog from "./ProjectSettingsDialog";

type Panel = "files" | "diagnostics" | "config" | null;

function EditorPrefsPanel() {
  return (
    <div class="flex flex-col gap-1 p-3">
      <p class="text-muted-foreground px-1 py-1.5 text-xs font-medium tracking-wide uppercase">
        Editor
      </p>
      <label class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm">
        <span>Vim mode</span>
        <SwitchInput checked={vimMode()} onChange={setVimMode} />
      </label>
      <label class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm">
        <span>Line numbers</span>
        <SwitchInput checked={showLineNumbers()} onChange={setShowLineNumbers} />
      </label>
      <label
        class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
        classList={{
          "cursor-pointer": showLineNumbers(),
          "cursor-not-allowed opacity-50": !showLineNumbers(),
        }}
      >
        <span>Relative line numbers</span>
        <SwitchInput
          checked={relativeLineNumbers()}
          onChange={setRelativeLineNumbers}
          disabled={!showLineNumbers()}
        />
      </label>
    </div>
  );
}

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

// Bridges the rail toggle to the resizable sidebar panel: collapsing/expanding
function SidebarCollapseSync(props: { open: boolean }) {
  const panel = usePanelContext();
  createEffect(() => {
    if (props.open) {
      if (panel.collapsed()) panel.expand();
    } else if (!panel.collapsed()) {
      panel.collapse();
    }
  });
  return null;
}

function ProjectView() {
  const ctx = useProjectContext();
  const [currentPanel, setCurrentPanel] = createSignal<Panel>("files");
  const [settingsOpen, setSettingsOpen] = createSignal(false);

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
          <span class="bg-border/60 h-5 w-px" />
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
          <UserMenu />
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
          <div class="mt-auto" />
          <RailButton
            label="Editor preferences"
            active={currentPanel() === "config"}
            onClick={() => {
              togglePanel("config");
            }}
            icon={<TbOutlineAdjustmentsHorizontal size={16} />}
          />
          <RailButton
            label="Project settings"
            active={settingsOpen()}
            onClick={() => {
              setSettingsOpen((s) => !s);
            }}
            icon={<TbOutlineSettings size={16} />}
          />
        </nav>
        <ProjectSettingsDialog
          open={settingsOpen()}
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
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
            <div class="min-h-0 min-w-0 flex-1">
              <Resizable orientation="horizontal">
                <ResizablePanel
                  initialSize={0.2}
                  minSize="200px"
                  collapsible
                  collapsedSize={0}
                  class="bg-sidebar overflow-hidden"
                >
                  <SidebarCollapseSync open={currentPanel() !== null} />
                  <div class="h-full" classList={{ hidden: currentPanel() !== "files" }}>
                    <FileSidebar />
                  </div>
                  <div class="h-full" classList={{ hidden: currentPanel() !== "diagnostics" }}>
                    <DiagnosticsPanel />
                  </div>
                  <div class="h-full" classList={{ hidden: currentPanel() !== "config" }}>
                    <EditorPrefsPanel />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel
                  initialSize={0.4}
                  minSize="320px"
                  class="flex min-w-0 flex-col overflow-hidden"
                >
                  <Show when={!ctx.activeIsAsset()}>
                    <EditorToolbar />
                  </Show>
                  <div class="min-h-0 flex-1">
                    <Show when={ctx.activeIsAsset()} fallback={<CodeMirrorEditor />}>
                      <AssetPreview />
                    </Show>
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel initialSize={0.4} minSize="280px" class="min-w-0 overflow-hidden">
                  <PreviewPane />
                </ResizablePanel>
              </Resizable>
            </div>
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
