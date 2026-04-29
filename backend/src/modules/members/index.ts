import { Elysia, t } from "elysia";

import { projectAccessMacro } from "../projects/macro";
import { memberModels, memberWithUserModel, projectMemberModel } from "./model";
import * as members from "./service";

export const memberRoutes = new Elysia({ name: "member-routes" })
  .use(projectAccessMacro)
  .model(memberModels)

  .get("/projects/:id/members", ({ project }) => members.list(project.id), {
    projectMember: true,
    response: t.Array(memberWithUserModel),
  })

  .delete(
    "/projects/:id/members/:userId",
    ({ project, params }) => members.remove(project.id, params.userId),
    { projectOwner: true, params: "member.byId", response: projectMemberModel }
  )

  .patch(
    "/projects/:id/members/:userId",
    ({ project, params, body }) => members.changeRole(project.id, params.userId, body.role),
    {
      projectOwner: true,
      params: "member.byId",
      body: "member.changeRole",
      response: projectMemberModel,
    }
  );
