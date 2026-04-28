import { Elysia, status, t } from "elysia";

import { authMacro } from "../auth/macro";
import { projectService } from "./service";

type AccessLevel = "member" | "owner";

const loadProject = async (userId: string, id: string, level: AccessLevel) => {
  const project = await projectService.findAuthorized(userId, id, level);
  if (!project) {
    return status(404, "Project not found");
  }
  return { project };
};

export const projectAccessMacro = new Elysia({ name: "project-access-macro" })
  .use(authMacro)
  .macro("projectMember", {
    auth: true,
    params: t.Object({ id: t.String() }),
    resolve: ({ params, user }) => loadProject(user.id, params.id, "member"),
  })
  .macro("projectOwner", {
    auth: true,
    params: t.Object({ id: t.String() }),
    resolve: ({ params, user }) => loadProject(user.id, params.id, "owner"),
  });
