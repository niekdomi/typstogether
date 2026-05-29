import { Elysia, t } from "elysia";

import { enforceCooldown } from "../../rate-limit";
import { projectAccessMacro } from "./macro";
import { projectMembershipModel, projectModel, projectModels, projectSnapshotModel } from "./model";
import { projectService } from "./service";

// Per-user cooldown between creates: collapses accidental double-submits
// (spamming Enter, Enter+click) into a single project.
const CREATE_COOLDOWN_MS = 1000;

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
    beforeHandle: ({ user }) => {
      enforceCooldown(
        `project-create:${user.id}`,
        CREATE_COOLDOWN_MS,
        "You're creating projects too quickly. Try again in a moment."
      );
    },
    response: projectModel,
  })

  .get("/:id", ({ project, role }) => ({ project, role }), {
    projectMember: true,
    response: projectMembershipModel,
  })

  .get("/:id/snapshot", ({ project }) => projectService.snapshot(project.id), {
    projectMember: true,
    response: projectSnapshotModel,
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
