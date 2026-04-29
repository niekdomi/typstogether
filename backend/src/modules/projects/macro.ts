import { Elysia } from "elysia";

import { ForbiddenError } from "../../errors";
import { authMacro } from "../auth/macro";
import { byIdProjectModel } from "./model";
import { projectService } from "./service";

export const projectAccessMacro = new Elysia({ name: "project-access-macro" })
  .use(authMacro)
  .macro("projectMember", {
    auth: true,
    params: byIdProjectModel,
    resolve: async ({ params, user }) => {
      const { project, role } = await projectService.getMembership(user.id, params.id);
      return { project, role };
    },
  })
  .macro("projectEditor", {
    auth: true,
    params: byIdProjectModel,
    resolve: async ({ params, user }) => {
      const { project, role } = await projectService.getMembership(user.id, params.id);
      if (role === "viewer") {
        throw new ForbiddenError("Editor role required");
      }
      return { project, role };
    },
  })
  .macro("projectOwner", {
    auth: true,
    params: byIdProjectModel,
    resolve: async ({ params, user }) => {
      const { project, role } = await projectService.getMembership(user.id, params.id);
      if (role !== "owner") {
        throw new ForbiddenError("Owner role required");
      }
      return { project, role };
    },
  });
