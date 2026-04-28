import { Elysia } from "elysia";

import { authMacro } from "../auth/macro";
import { byIdProjectModel } from "./model";
import { projectService } from "./service";

export const projectAccessMacro = new Elysia({ name: "project-access-macro" })
  .use(authMacro)
  .macro("projectMember", {
    auth: true,
    params: byIdProjectModel,
    resolve: async ({ params, user }) => ({
      project: await projectService.getAccessibleBy(user.id, params.id),
    }),
  })
  .macro("projectOwner", {
    auth: true,
    params: byIdProjectModel,
    resolve: async ({ params, user }) => ({
      project: await projectService.getOwnedBy(user.id, params.id),
    }),
  });
