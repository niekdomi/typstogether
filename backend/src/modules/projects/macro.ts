import { Elysia, status } from "elysia";

import { auth } from "../auth/service";
import { projectService } from "./service";

type AccessLevel = "member" | "owner";

export const projectAccessMacro = new Elysia({ name: "project-access-macro" }).macro({
  projectAccess: (level: AccessLevel) => ({
    resolve: async ({ request, params }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        return status(401, "Unauthorized");
      }

      const id = (params as { id?: string }).id;
      if (!id) {
        return status(404, "Project not found");
      }

      const project = await projectService.findAuthorized(session.user.id, id, level);
      if (!project) {
        return status(404, "Project not found");
      }

      return { user: session.user, session: session.session, project };
    },
  }),
});
