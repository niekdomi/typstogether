import { A } from "@solidjs/router";
import { For, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";

interface Project {
  id: string;
  name: string;
}

export default function Dashboard() {
  const [projects, setProjects] = createStore<Project[]>([
    { id: "1", name: "Project 1" },
    { id: "2", name: "Project 2" },
  ]);
  const [newName, setNewName] = createSignal("");

  function createProject() {
    const name = newName().trim();
    if (!name) return;
    setProjects(projects.length, { id: crypto.randomUUID(), name });
    setNewName("");
  }

  function deleteProject(id: string) {
    setProjects(
      produce((draft) => {
        const idx = draft.findIndex((p) => p.id === id);
        if (idx !== -1) draft.splice(idx, 1);
      })
    );
  }

  return (
    <main>
      <h1>Projects</h1>
      <ul>
        <For each={projects}>
          {(project) => (
            <li>
              <span>{project.name}</span>
              <A href={`/project/${project.id}`}>Open</A>
              <button
                onClick={() => {
                  deleteProject(project.id);
                }}
              >
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
      <input
        value={newName()}
        onInput={(e) => setNewName(e.currentTarget.value)}
        placeholder="Project name"
      />
      <button onClick={createProject}>New Project</button>
    </main>
  );
}
