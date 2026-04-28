import { Elysia, status } from "elysia";

import { authMacro } from "../auth/macro";
import { projectAccessMacro } from "./macro";
import { projectModels } from "./model";
import { projectService } from "./service";

export const projectRoutes = new Elysia({ name: "project-routes", prefix: "/projects" })
  .use(authMacro)
  .use(projectAccessMacro)
  .model(projectModels)

  .get("/", ({ user }) => projectService.list(user.id), { auth: true })

  .post("/", ({ user, body }) => projectService.create(user.id, body), {
    body: "project.create",
    auth: true,
  })

  .get("/:id", ({ project }) => project, {
    params: "project.idParams",
    projectAccess: "member",
  })

  .delete(
    "/:id",
    async ({ project }) => {
      const deleted = await projectService.delete(project.id);
      if (!deleted) {
        return status(404, "Project not found");
      }
      return deleted;
    },
    { params: "project.idParams", projectAccess: "owner" }
  );
