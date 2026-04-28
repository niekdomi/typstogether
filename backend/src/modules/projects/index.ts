import { Elysia } from "elysia";

import { authMacro } from "../auth/macro";
import { projectModels } from "./model";
import { projectService } from "./service";

export const projectRoutes = new Elysia({ name: "project-routes", prefix: "/projects" })
  .use(authMacro)
  .model(projectModels)

  .get("/", ({ user }) => projectService.list(user.id), { auth: true })

  .post("/", ({ user, body }) => projectService.create(user.id, body), {
    body: "project.create",
    auth: true,
  })

  .get("/:id", ({ user, params }) => projectService.get(user.id, params.id), {
    params: "project.idParams",
    auth: true,
  })

  .delete("/:id", ({ user, params }) => projectService.delete(user.id, params.id), {
    params: "project.idParams",
    auth: true,
  });
