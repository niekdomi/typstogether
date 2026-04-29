import { Elysia } from "elysia";

import { projectAccessMacro } from "./macro";
import { projectModels } from "./model";
import { projectService } from "./service";

export const projectRoutes = new Elysia({ name: "project-routes", prefix: "/projects" })
  .use(projectAccessMacro)
  .model(projectModels)

  .get("/", ({ user }) => projectService.list(user.id), { auth: true })

  .post("/", ({ user, body }) => projectService.create(user.id, body), {
    body: "project.create",
    auth: true,
  })

  .get("/:id", ({ project, role }) => ({ project, role }), { projectMember: true })

  .delete("/:id", ({ project }) => projectService.delete(project.id), { projectOwner: true });
