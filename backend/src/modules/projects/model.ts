import { t } from "elysia";

const create = t.Object({ name: t.String({ minLength: 1 }) });

export const projectModels = {
  "project.create": create,
};

export type CreateProjectInput = typeof create.static;
