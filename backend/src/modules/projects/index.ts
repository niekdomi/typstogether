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

  .delete("/:id", ({ project }) => projectService.delete(project.id), {
    projectOwner: true,
    response: projectModel,
  });
