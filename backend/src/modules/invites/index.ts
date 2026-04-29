import { Elysia, t } from "elysia";

import { projectAccessMacro } from "../projects/macro";
import { projectMembershipModel } from "../projects/model";
import { inviteModels, publicInviteModel } from "./model";
import * as invites from "./service";

export const inviteRoutes = new Elysia({ name: "invite-routes" })
  .use(projectAccessMacro)
  .model(inviteModels)

  .get("/projects/:id/invites", ({ project }) => invites.list(project.id), {
    projectOwner: true,
    response: t.Array(publicInviteModel),
  })

  .post(
    "/projects/:id/invites",
    ({ project, user, body }) =>
      invites.create({ projectId: project.id, createdByUserId: user.id, ...body }),
    {
      projectOwner: true,
      body: "invite.create",
      response: t.Object({ invite: publicInviteModel, token: t.String() }),
    }
  )

  .delete(
    "/projects/:id/invites/:inviteId",
    ({ project, params }) => invites.revoke(project.id, params.inviteId),
    { projectOwner: true, params: "invite.byId", response: publicInviteModel }
  )

  .post("/invites/:token/redeem", ({ user, params }) => invites.redeem(user.id, params.token), {
    auth: true,
    params: "invite.byToken",
    response: projectMembershipModel,
  });
