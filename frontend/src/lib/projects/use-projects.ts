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

  async function rename(id: string, newName: string) {
    const { error } = await api.projects({ id }).patch({ name: newName });
    if (error) {
      toast.error("Could not rename project.");
      return;
    }
    void refetch();
  }

  async function remove(id: string) {
    const { error } = await api.projects({ id }).delete();
    if (error) {
      toast.error("Could not delete project.");
      return;
    }
    void refetch();
  }

  async function create(name: string, onSuccess?: () => void) {
    const { error } = await api.projects.post({ name });
    if (error) {
      toast.error("Could not create project.");
      return;
    }
    void refetch();
    onSuccess?.();
  }

  return { projects, rename, remove, create };
}
