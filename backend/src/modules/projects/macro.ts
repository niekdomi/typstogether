import { Elysia } from "elysia";

import { ForbiddenError } from "../../errors";
import { authMacro } from "../auth/macro";
import { type ByIdProjectParams, byIdProjectModel } from "./model";
import * as projects from "./service";
import { type ProjectRole } from "./service";

const requireRole = (allowed: readonly ProjectRole[]) => ({
  auth: true as const,
  params: byIdProjectModel,
  resolve: async ({ params, user }: { params: ByIdProjectParams; user: { id: string } }) => {
    const { project, role } = await projects.getMembership(user.id, params.id);
    if (!allowed.includes(role)) {
      throw new ForbiddenError(`${allowed.join(" or ")} role required`);
    }
    return { project, role };
  },
});

export const projectAccessMacro = new Elysia({ name: "project-access-macro" })
  .use(authMacro)
  .macro("projectMember", requireRole(["owner", "editor", "viewer"]))
  .macro("projectEditor", requireRole(["owner", "editor"]))
  .macro("projectOwner", requireRole(["owner"]));
