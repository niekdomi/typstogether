import { createResource } from "solid-js";
import { toast } from "somoto";

import { api } from "../api";
import type { Membership } from "./types";

async function loadProjects(): Promise<Membership[]> {
  const { data } = await api.projects.get();
  return data ?? [];
}

export function useProjects() {
  const [projects, { refetch }] = createResource(loadProjects);

  async function mutate(
    fn: () => Promise<{ error: unknown }>,
    errorMsg: string,
    onSuccess?: () => void
  ) {
    const { error } = await fn();
    if (error) {
      toast.error(errorMsg);
      return;
    }
    void refetch();
    onSuccess?.();
  }

  const rename = (id: string, newName: string) =>
    mutate(() => api.projects({ id }).patch({ name: newName }), "Could not rename project.");

  const remove = (id: string) =>
    mutate(() => api.projects({ id }).delete(), "Could not delete project.");

  const create = (name: string, onSuccess?: () => void) =>
    mutate(() => api.projects.post({ name }), "Could not create project.", onSuccess);

  return { projects, rename, remove, create };
}
