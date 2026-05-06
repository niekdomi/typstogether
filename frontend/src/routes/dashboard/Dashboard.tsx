import { useNavigate } from "@solidjs/router";
import { SiGithub } from "solid-icons/si";
import { For, Match, Switch, createMemo, createResource, createSignal } from "solid-js";

import { api } from "../../lib/api";
import { authClient } from "../../lib/auth";
import NewProjectModal from "./NewProjectModal";
import PageHeader from "./PageHeader";
import ProjectCard from "./ProjectCard";
import TabsBar from "./TabsBar";
import TopBar from "./TopBar";
import type { Membership, Sort, Tab } from "./types";

import "./Dashboard.css";

async function loadProjects(): Promise<Membership[]> {
  const { data } = await api.projects.get();
  return data ?? [];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [projects, { refetch }] = createResource(loadProjects);

  const [tab, setTab] = createSignal<Tab>("owned");
  const [query, setQuery] = createSignal("");
  const [sort, setSort] = createSignal<Sort>("modified");
  const [modalOpen, setModalOpen] = createSignal(false);

  const all = () => projects() ?? [];
  const owned = () => all().filter((p) => p.role === "owner");
  const shared = () => all().filter((p) => p.role !== "owner");

  const list = createMemo(() => {
    const base = tab() === "owned" ? owned() : shared();
    const q = query().toLowerCase().trim();
    const filtered = q ? base.filter((p) => p.project.name.toLowerCase().includes(q)) : base;
    const sorted = [...filtered];
    if (sort() === "title") {
      sorted.sort((a, b) => a.project.name.localeCompare(b.project.name));
    } else {
      sorted.sort(
        (a, b) => new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime()
      );
    }
    return sorted;
  });

  async function signOut() {
    await authClient.signOut();
    navigate("/login");
  }

  async function renameProject(id: string, currentName: string) {
    const next = globalThis.prompt("New project name", currentName);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentName) return;
    const { error } = await api.projects({ id }).patch({ name: trimmed });
    if (error) {
      console.error("Failed to rename project:", error);
      return;
    }
    void refetch();
  }

  async function deleteProject(id: string, name: string) {
    if (!globalThis.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await api.projects({ id }).delete();
    if (error) {
      console.error("Failed to delete project:", error);
      return;
    }
    void refetch();
  }

  async function createProject(name: string) {
    const { error } = await api.projects.post({ name });
    if (error) {
      console.error("Failed to create project:", error);
      return;
    }
    setModalOpen(false);
    void refetch();
  }

  return (
    <div class="fade-in dashboard">
      <TopBar
        query={query()}
        onQuery={setQuery}
        userName={session().data?.user.name}
        userImage={session().data?.user.image}
        onSignOut={() => void signOut()}
      />
      <main>
        <PageHeader totalCount={all().length} onNewProject={() => setModalOpen(true)} />
        <TabsBar
          tab={tab()}
          onTab={setTab}
          sort={sort()}
          onSort={setSort}
          ownedCount={owned().length}
          sharedCount={shared().length}
        />
        <Switch
          fallback={
            <div class="grid">
              <For each={list()}>
                {(m) => (
                  <ProjectCard
                    project={m.project}
                    role={m.role}
                    onOpen={() => {
                      navigate(`/project/${m.project.id}`);
                    }}
                    onRename={() => void renameProject(m.project.id, m.project.name)}
                    onDelete={() => void deleteProject(m.project.id, m.project.name)}
                  />
                )}
              </For>
            </div>
          }
        >
          <Match when={projects.loading}>
            <div class="empty">
              <p>Loading projects…</p>
            </div>
          </Match>
          <Match when={projects.error !== undefined}>
            <div class="empty">
              <p>Could not load projects.</p>
            </div>
          </Match>
          <Match when={list().length === 0}>
            <div class="empty">
              <p>No matching projects.</p>
            </div>
          </Match>
        </Switch>
        <footer class="footer">
          <span class="mono footer-rhs">
            MIT ·
            <a
              class="footer-link"
              href="https://github.com/niekdomi/typstogether"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub repository"
            >
              <SiGithub size={13} />
            </a>
          </span>
        </footer>
      </main>
      <NewProjectModal
        open={modalOpen()}
        onClose={() => setModalOpen(false)}
        onSubmit={(name) => void createProject(name)}
      />
    </div>
  );
}
