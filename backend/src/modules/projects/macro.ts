import { Elysia, status, t } from "elysia";

import { authMacro } from "../auth/macro";
import { projectService } from "./service";

const projectOr404 = <T>(project: T | undefined) =>
  project ? { project } : status(404, "Project not found");

export const projectAccessMacro = new Elysia({ name: "project-access-macro" })
  .use(authMacro)
  .macro("projectMember", {
    auth: true,
    params: t.Object({ id: t.String() }),
    resolve: async ({ params, user }) =>
      projectOr404(await projectService.findAccessibleBy(user.id, params.id)),
  })
  .macro("projectOwner", {
    auth: true,
    params: t.Object({ id: t.String() }),
    resolve: async ({ params, user }) =>
      projectOr404(await projectService.findOwnedBy(user.id, params.id)),
  });
