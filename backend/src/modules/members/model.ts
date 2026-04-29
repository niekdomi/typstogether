import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

import { projectMember } from "../../db/app-schema";
import { user } from "../../db/auth-schema";

export const memberRoleModel = t.Union([t.Literal("editor"), t.Literal("viewer")]);

export const changeRoleBodyModel = t.Object({ role: memberRoleModel });

export const memberByIdModel = t.Object({ id: t.String(), userId: t.String() });

const projectMemberSchema = createSelectSchema(projectMember);
const userSchema = createSelectSchema(user);
const publicUserModel = t.Pick(userSchema, ["id", "name", "email", "image"]);

export const memberWithUserModel = t.Object({
  member: projectMemberSchema,
  user: publicUserModel,
});

export const memberModels = {
  "member.changeRole": changeRoleBodyModel,
  "member.byId": memberByIdModel,
  "member.withUser": memberWithUserModel,
};

export type ChangeRoleBody = typeof changeRoleBodyModel.static;
export type MemberByIdParams = typeof memberByIdModel.static;
