import { Elysia, t } from "elysia";

import { projectAccessMacro } from "../projects/macro";
import { memberModels, memberWithUserModel } from "./model";
import { memberService } from "./service";

export const memberRoutes = new Elysia({ name: "member-routes" })
  .use(projectAccessMacro)
  .model(memberModels)

  .get("/projects/:id/members", ({ project }) => memberService.list(project.id), {
    projectMember: true,
    response: t.Array(memberWithUserModel),
  })

  .delete(
    "/projects/:id/members/:userId",
    ({ project, params }) => memberService.remove(project.id, params.userId),
    { projectOwner: true, params: "member.byId" }
  )

  .patch(
    "/projects/:id/members/:userId",
    ({ project, params, body }) => memberService.changeRole(project.id, params.userId, body.role),
    { projectOwner: true, params: "member.byId", body: "member.changeRole" }
  );
