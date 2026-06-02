import { Elysia, t } from "elysia";

import { ForbiddenError } from "../../errors";
import { projectAccessMacro } from "../projects/macro";
import { memberModels, memberWithUserModel, projectMemberModel } from "./model";
import { memberService } from "./service";

export const memberRoutes = new Elysia({ name: "member-routes" })
  .use(projectAccessMacro)
  .model(memberModels)

  .get("/projects/:id/members", ({ project }) => memberService.list(project.id), {
    projectMember: true,
    response: t.Array(memberWithUserModel),
  })

  // A member leaves a project on their own. Owners have no `project_member` row
  // and own the project, so they delete it instead of leaving.
  .delete(
    "/projects/:id/members/me",
    ({ project, role, user }) => {
      if (role === "owner") {
        throw new ForbiddenError("Owners cannot leave their own project");
      }
      return memberService.remove(project.id, user.id);
    },
    { projectMember: true, response: projectMemberModel }
  )

  .delete(
    "/projects/:id/members/:userId",
    ({ project, params }) => memberService.remove(project.id, params.userId),
    { projectOwner: true, params: "member.byId", response: projectMemberModel }
  )

  .patch(
    "/projects/:id/members/:userId",
    ({ project, params, body }) => memberService.changeRole(project.id, params.userId, body.role),
    {
      projectOwner: true,
      params: "member.byId",
      body: "member.changeRole",
      response: projectMemberModel,
    }
  );
