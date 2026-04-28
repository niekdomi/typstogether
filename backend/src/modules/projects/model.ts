import { t } from "elysia";

const create = t.Object({ name: t.String({ minLength: 1 }) });
const idParams = t.Object({ id: t.String() });

export const projectModels = {
  "project.create": create,
  "project.idParams": idParams,
};

export type CreateProjectInput = typeof create.static;
