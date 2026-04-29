import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

import { projectInvite } from "../../db/app-schema";

export const inviteCreateModel = t.Object({
  role: t.Union([t.Literal("editor"), t.Literal("viewer")]),
  expiresAt: t.Date(),
});

export const inviteByTokenModel = t.Object({ token: t.String({ minLength: 1 }) });
export const inviteByIdModel = t.Object({ id: t.String(), inviteId: t.String() });

const projectInviteSchema = createSelectSchema(projectInvite);
export const publicInviteModel = t.Omit(projectInviteSchema, ["tokenHash"]);

export const inviteModels = {
  "invite.create": inviteCreateModel,
  "invite.byToken": inviteByTokenModel,
  "invite.byId": inviteByIdModel,
};

export type CreateInviteInput = typeof inviteCreateModel.static;
export type ByTokenInviteParams = typeof inviteByTokenModel.static;
export type ByIdInviteParams = typeof inviteByIdModel.static;
export type PublicInvite = typeof publicInviteModel.static;
