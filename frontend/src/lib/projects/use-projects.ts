import { createResource } from "solid-js";
import { toast } from "somoto";

import { api, apiErrorMessage } from "../api";
import { deleteThumbnail } from "../typst/thumbnail-cache";
import type { Membership } from "./types";

async function loadProjects(): Promise<Membership[]> {
  const { data } = await api.projects.get();
  return data ?? [];
}

export function useProjects() {
  const [projects, { refetch }] = createResource(loadProjects);

  /**
   * Runs an API call, shows a toast on error, and refetches the list on success.
   * Returns whether the call succeeded so callers can gate UI on the outcome.
   */
  async function mutate(
    fn: () => Promise<{ error: unknown }>,
    errorMsg: string,
    onSuccess?: () => void
  ): Promise<boolean> {
    const { error } = await fn();
    if (error) {
      toast.error(apiErrorMessage(error, errorMsg));
      return false;
    }

    void refetch();
    onSuccess?.();
    return true;
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

  const create = (name: string, template: { id: string; version: string } | undefined) =>
    mutate(() => api.projects.post({ name, template }), "Could not create project.");

  const join = (token: string) =>
    mutate(() => api.invites({ token }).redeem.post(), "This invite link is invalid or expired.");

  const leave = (id: string) =>
    mutate(
      () => api.projects({ id }).members.me.delete(),
      "Could not leave project.",
      () => {
        void deleteThumbnail(id);
      }
    );

  return { projects, rename, remove, create, join, leave };
}
