import { createResource } from "solid-js";
import { toast } from "somoto";

import { api } from "../api";
import { deleteThumbnail } from "../typst/thumbnail-cache";
import type { Membership } from "./types";

async function loadProjects(): Promise<Membership[]> {
  const { data } = await api.projects.get();
  return data ?? [];
}

export function useProjects() {
  const [projects, { refetch }] = createResource(loadProjects);

  /** Runs an API call, shows a toast on error, and refetches the list on success. */
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
    mutate(
      () => api.projects({ id }).delete(),
      "Could not delete project.",
      () => {
        void deleteThumbnail(id);
      }
    );

  const create = (
    name: string,
    template: { id: string; version: string } | undefined,
    onSuccess?: () => void
  ) => mutate(() => api.projects.post({ name, template }), "Could not create project.", onSuccess);

  return { projects, rename, remove, create };
}
