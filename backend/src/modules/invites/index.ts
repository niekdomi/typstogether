import { Elysia, t } from "elysia";

import { projectAccessMacro } from "../projects/macro";
import { projectMembershipModel } from "../projects/model";
import { inviteModels, publicInviteModel } from "./model";
import { inviteService } from "./service";

export const inviteRoutes = new Elysia({ name: "invite-routes" })
  .use(projectAccessMacro)
  .model(inviteModels)

  .get("/projects/:id/invites", ({ project }) => inviteService.list(project.id), {
    projectOwner: true,
    response: t.Array(publicInviteModel),
  })

  .post(
    "/projects/:id/invites",
    ({ project, user, body }) =>
      inviteService.create({ projectId: project.id, createdByUserId: user.id, ...body }),
    {
      projectOwner: true,
      body: "invite.create",
      response: t.Object({ invite: publicInviteModel, token: t.String() }),
    }
  )

  .delete(
    "/projects/:id/invites/:inviteId",
    ({ project, params }) => inviteService.revoke(project.id, params.inviteId),
    { projectOwner: true, params: "invite.byId", response: publicInviteModel }
  )

  .post(
    "/invites/:token/redeem",
    ({ user, params }) => inviteService.redeem(user.id, params.token),
    { auth: true, params: "invite.byToken", response: projectMembershipModel }
  );
