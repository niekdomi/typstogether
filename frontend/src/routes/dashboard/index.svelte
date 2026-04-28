<script lang="ts">
  import { p } from "sv-router/generated";

  type Project = {
    id: string;
    name: string;
  };

  // TODO: Replace with API
  let projects = $state<Project[]>([
    { id: "1", name: "Project 1" },
    { id: "2", name: "Project 2" },
  ]);

  let newProjectName = $state("");

  function createProject() {
    if (!newProjectName.trim()) {
      return;
    }

    projects.push({ id: crypto.randomUUID(), name: newProjectName.trim() });
    newProjectName = "";
  }

  function deleteProject(id: string) {
    projects = projects.filter((project) => project.id !== id);
  }
</script>

<main>
  <h1>Projects</h1>
  <ul>
    {#each projects as project (project.id)}
      <li>
        <span>{project.name}</span>
        <a href={p("/dashboard")}>Open</a>
        <button onclick={() => deleteProject(project.id)}>Delete</button>
      </li>
    {/each}
  </ul>

  <input value={newProjectName} placeholder="Project name" />
  <button onclick={createProject}>New Project</button>
</main>
