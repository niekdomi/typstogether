import { Elysia, t } from "elysia";

import { authMacro } from "../auth/macro";
import { projectService } from "./service";

export const projectAccessMacro = new Elysia({ name: "project-access-macro" })
  .use(authMacro)
  .macro("projectMember", {
    auth: true,
    params: t.Object({ id: t.String() }),
    resolve: async ({ params, user }) => ({
      project: await projectService.getAccessibleBy(user.id, params.id),
    }),
  })
  .macro("projectOwner", {
    auth: true,
    params: t.Object({ id: t.String() }),
    resolve: async ({ params, user }) => ({
      project: await projectService.getOwnedBy(user.id, params.id),
    }),
  });
