import { useNavigate } from "@solidjs/router";
import { For, Match, Switch, createMemo, createResource, createSignal } from "solid-js";

import { api } from "../../lib/api";
import { authClient } from "../../lib/auth";
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
  const [creating, setCreating] = createSignal(false);

  const all = () => projects() ?? [];
  const owned = () => all().filter((p) => p.role === "owner");
  const shared = () => all().filter((p) => p.role !== "owner");

  const list = createMemo(() => {
    const t = tab();
    if (t === "templates" || t === "trash") return [];
    const base = t === "owned" ? owned() : shared();
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

  async function createProject(name: string) {
    const { error } = await api.projects.post({ name });
    if (error) {
      console.error("Failed to create project:", error);
      return;
    }
    setCreating(false);
    void refetch();
  }

  return (
    <div class="fade-in dashboard">
      <TopBar
        query={query()}
        onQuery={setQuery}
        userName={session().data?.user.name}
        onSignOut={() => void signOut()}
      />
      <main>
        <PageHeader
          totalCount={all().length}
          creating={creating()}
          onStartCreate={() => setCreating(true)}
          onCancelCreate={() => setCreating(false)}
          onSubmitCreate={(name) => void createProject(name)}
        />
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
          <span class="mono">typstogether v0.1</span>
          <span class="mono">MIT · github.com/typstogether</span>
        </footer>
      </main>
    </div>
  );
}
