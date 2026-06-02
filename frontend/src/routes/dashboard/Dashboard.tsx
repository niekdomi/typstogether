import { useNavigate } from "@solidjs/router";
import { SiGithub } from "solid-icons/si";
import { For, Match, Switch, createMemo, createSignal } from "solid-js";

import { Alert, AlertDescription } from "../../components/ui/alert";
import { useProjects } from "../../lib/projects/use-projects";
import ConfirmDialog from "./ConfirmDialog";
import DashboardHeader from "./DashboardHeader";
import InviteDialog from "./InviteDialog";
import NewProjectModal from "./NewProjectModal";
import ProjectCard from "./ProjectCard";
import PromptDialog from "./PromptDialog";
import TopBar from "./TopBar";

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, rename, remove, create, join } = useProjects();

  const [query, setQuery] = createSignal("");
  const [modalOpen, setModalOpen] = createSignal(false);
  const [joinOpen, setJoinOpen] = createSignal(false);
  const [renameTarget, setRenameTarget] = createSignal<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<{ id: string; name: string } | null>(null);
  const [shareTarget, setShareTarget] = createSignal<{ id: string; name: string } | null>(null);

  const all = () => projects() ?? [];

  const list = createMemo(() => {
    const q = query().toLowerCase().trim();
    const filtered = q ? all().filter((p) => p.project.name.toLowerCase().includes(q)) : all();
    return filtered.toSorted(
      (a, b) => new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime()
    );
  });

  return (
    <div class="bg-background flex h-screen flex-col overflow-hidden">
      <TopBar query={query()} onQuery={setQuery} />
      <main class="mx-auto flex min-h-0 w-full max-w-310 flex-1 flex-col px-8 py-10">
        <h1 class="mt-2 mb-8 text-[44px] font-medium tracking-[-0.02em]">Projects</h1>
        <DashboardHeader
          onNewProject={() => setModalOpen(true)}
          onJoinProject={() => setJoinOpen(true)}
        />
        <div class="min-h-0 flex-1 overflow-y-auto pr-3">
          <Switch
            fallback={
              <div class="my-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-7">
                <For each={list()}>
                  {(m) => (
                    <ProjectCard
                      project={m.project}
                      role={m.role}
                      onOpen={() => {
                        navigate(`/project/${m.project.id}`);
                      }}
                      onShare={() => setShareTarget({ id: m.project.id, name: m.project.name })}
                      onRename={() => setRenameTarget({ id: m.project.id, name: m.project.name })}
                      onDelete={() => setDeleteTarget({ id: m.project.id, name: m.project.name })}
                    />
                  )}
                </For>
              </div>
            }
          >
            <Match when={projects.error !== undefined}>
              <Alert variant="destructive" class="mt-6">
                <AlertDescription>Could not load projects.</AlertDescription>
              </Alert>
            </Match>
            <Match when={!projects.loading && list().length === 0}>
              <p class="text-muted-foreground mt-6 py-16 text-center italic">
                No matching projects.
              </p>
            </Match>
          </Switch>
        </div>
        <footer class="border-border/60 flex justify-end border-t pt-6">
          <a
            href="https://github.com/niekdomi/typstogether"
            target="_blank"
            rel="noreferrer noopener"
            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-mono text-[11px] transition-colors"
          >
            <SiGithub size={20} />
            GitHub
          </a>
        </footer>
      </main>

      <NewProjectModal open={modalOpen()} onClose={() => setModalOpen(false)} onSubmit={create} />
      <PromptDialog
        open={joinOpen()}
        onClose={() => setJoinOpen(false)}
        onSubmit={(value) => {
          const token = /invite\/([^/?#]+)/.exec(value)?.[1] ?? value;
          void join(token);
        }}
        title="Join a project"
        label="Invite link"
        submitLabel="Join"
      />

      <PromptDialog
        open={renameTarget() !== null}
        onClose={() => setRenameTarget(null)}
        onSubmit={(newName) => {
          const target = renameTarget();
          if (target && newName !== target.name) void rename(target.id, newName);
        }}
        title="Rename project"
        label="Name"
        initialValue={renameTarget()?.name ?? ""}
        submitLabel="Rename"
      />

      <ConfirmDialog
        open={deleteTarget() !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget();
          if (target) void remove(target.id);
        }}
        title="Delete project"
        message={`Delete "${deleteTarget()?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      <InviteDialog
        open={shareTarget() !== null}
        onClose={() => setShareTarget(null)}
        projectId={shareTarget()?.id ?? null}
        projectName={shareTarget()?.name ?? ""}
      />
    </div>
  );
}
