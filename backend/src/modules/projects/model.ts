import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

import { project } from "../../db/app-schema";

export const createProjectModel = t.Object({
  name: t.String({ minLength: 1 }),
  template: t.Optional(
    t.Object({
      id: t.String({ minLength: 1 }),
      version: t.String({ minLength: 1 }),
    })
  ),
});
export const updateProjectModel = t.Object({ name: t.String({ minLength: 1 }) });
export const byIdProjectModel = t.Object({ id: t.String() });

export const projectModel = createSelectSchema(project);

export const projectRoleModel = t.Union([
  t.Literal("owner"),
  t.Literal("editor"),
  t.Literal("viewer"),
]);

export const projectMembershipModel = t.Object({
  project: projectModel,
  role: projectRoleModel,
});

export const projectModels = {
  "project.create": createProjectModel,
  "project.update": updateProjectModel,
  "project.byId": byIdProjectModel,
};

export type CreateProjectInput = typeof createProjectModel.static;
export type UpdateProjectInput = typeof updateProjectModel.static;
export type ByIdProjectParams = typeof byIdProjectModel.static;
