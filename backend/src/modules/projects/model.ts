import { t } from "elysia";

export const createProjectModel = t.Object({ name: t.String({ minLength: 1 }) });
export const byIdProjectModel = t.Object({ id: t.String() });

export const projectModels = {
  "project.create": createProjectModel,
  "project.byId": byIdProjectModel,
};

export type CreateProjectInput = typeof createProjectModel.static;
export type ByIdProjectParams = typeof byIdProjectModel.static;
