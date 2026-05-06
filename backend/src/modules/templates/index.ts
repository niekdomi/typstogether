import { Elysia, t } from "elysia";

import { templateModel } from "./model";
import { templateService } from "./service";

export const templateRoutes = new Elysia({ name: "template-routes", prefix: "/templates" }).get(
  "/",
  () => templateService.list(),
  {
    response: t.Array(templateModel),
  }
);
