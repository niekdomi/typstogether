import { projectService } from "../projects/service";

export async function authorizeCollab(
  userId: string,
  projectId: string
): Promise<{ readOnly: boolean }> {
  const membership = await projectService.getMembership(userId, projectId);
  return { readOnly: membership.role === "viewer" };
}

