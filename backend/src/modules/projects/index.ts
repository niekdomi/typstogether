import { Elysia, t } from "elysia";

import { projectAccessMacro } from "./macro";
import { projectMembershipModel, projectModel, projectModels } from "./model";
import { projectService } from "./service";

export const projectRoutes = new Elysia({ name: "project-routes", prefix: "/projects" })
  .use(projectAccessMacro)
  .model(projectModels)

  .get("/", ({ user }) => projectService.list(user.id), {
    auth: true,
    response: t.Array(projectMembershipModel),
  })

  .post("/", ({ user, body }) => projectService.create(user.id, body), {
    body: "project.create",
    auth: true,
    response: projectModel,
  })

  .get("/:id", ({ project, role }) => ({ project, role }), {
    projectMember: true,
    response: projectMembershipModel,
  })

  .patch("/:id", ({ project, body }) => projectService.update(project.id, body), {
    body: "project.update",
    projectOwner: true,
    response: projectModel,
  })

  .delete("/:id", ({ project }) => projectService.remove(project.id), {
    projectOwner: true,
    response: projectModel,
  });
