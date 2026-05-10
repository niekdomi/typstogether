import { createResource } from "solid-js";

import { api } from "./api";
import type { Membership } from "./types";

async function loadProject(id: string): Promise<Membership> {
  const { data, error } = await api.projects({ id }).get();
  if (error) throw new Error(`Failed to load project (${String(error.status)})`);
  return data;
}

export function useProject(id: () => string) {
  const [project] = createResource(id, loadProject);
  return project;
}
