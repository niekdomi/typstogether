import { ForbiddenError, NotFoundError } from "../../errors";
import { projectService } from "../projects/service";

export async function authorizeCollab(
  userId: string,
  projectId: string
): Promise<{ readOnly: boolean }> {
  let membership;
  try {
    membership = await projectService.getMembership(userId, projectId);
  } catch (error) {
    // getMembership throws NotFoundError for both missing projects and lack of access
    if (error instanceof NotFoundError) throw new ForbiddenError();
    throw error;
  }
  return { readOnly: membership.role === "viewer" };
}
