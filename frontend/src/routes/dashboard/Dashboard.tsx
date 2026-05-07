import { useNavigate } from "@solidjs/router";
import { SiGithub } from "solid-icons/si";
import { For, Match, Switch, createMemo, createSignal } from "solid-js";

import ConfirmDialog from "../../components/ConfirmDialog";
import PromptDialog from "../../components/PromptDialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";
import { authClient } from "../../lib/auth";
import { useProjects } from "../../lib/use-projects";
import InviteDialog from "./InviteDialog";
import NewProjectModal from "./NewProjectModal";
import ProjectCard from "./ProjectCard";
import TabsBar, { type Tab } from "./TabsBar";
import TopBar from "./TopBar";

export default function Dashboard() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const { projects, rename, remove, create } = useProjects();

  const [tab, setTab] = createSignal<Tab>("owned");
  const [query, setQuery] = createSignal("");
  const [modalOpen, setModalOpen] = createSignal(false);
  const [renameTarget, setRenameTarget] = createSignal<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<{ id: string; name: string } | null>(null);
  const [shareTarget, setShareTarget] = createSignal<{ id: string; name: string } | null>(null);

  const all = () => projects() ?? [];
  const owned = () => all().filter((p) => p.role === "owner");
  const shared = () => all().filter((p) => p.role !== "owner");

  const list = createMemo(() => {
    const base = tab() === "owned" ? owned() : shared();
    const q = query().toLowerCase().trim();
    const filtered = q ? base.filter((p) => p.project.name.toLowerCase().includes(q)) : base;
    return filtered.toSorted(
      (a, b) => new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime()
    );
  });

  async function signOut() {
    await authClient.signOut();
    navigate("/login");
  }

  return (
    <div class="flex min-h-screen flex-col bg-background">
      <TopBar
        query={query()}
        onQuery={setQuery}
        userName={session().data?.user.name}
        userEmail={session().data?.user.email}
        userImage={session().data?.user.image}
        onSignOut={() => void signOut()}
      />
      <main class="mx-auto flex w-full max-w-310 flex-1 flex-col px-8 py-10">
        <h1 class="mb-8 mt-2 text-[44px] font-medium tracking-[-0.02em]">Projects</h1>
        <TabsBar
          tab={tab()}
          onTab={setTab}
          ownedCount={owned().length}
          sharedCount={shared().length}
          onNewProject={() => setModalOpen(true)}
        />
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
          <Match when={projects.loading}>
            <div class="my-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-7">
              <For each={Array.from({ length: 8 })}>
                {() => <Skeleton class="aspect-[1/1.4] rounded-xl" />}
              </For>
            </div>
          </Match>
          <Match when={projects.error !== undefined}>
            <Alert variant="destructive" class="mt-6">
              <AlertDescription>Could not load projects.</AlertDescription>
            </Alert>
          </Match>
          <Match when={list().length === 0}>
            <p class="mt-6 py-16 text-center italic text-muted-foreground">No matching projects.</p>
          </Match>
        </Switch>
        <footer class="mt-auto flex justify-end border-t border-border/60 pt-6">
          <a
            href="https://github.com/niekdomi/typstogether"
            target="_blank"
            rel="noreferrer noopener"
            class="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <SiGithub size={20} />
            GitHub
          </a>
        </footer>
      </main>

      <NewProjectModal
        open={modalOpen()}
        onClose={() => setModalOpen(false)}
        onSubmit={(name) => void create(name, () => setModalOpen(false))}
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
