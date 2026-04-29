import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { NotFoundError } from "./errors";
import { authRoutes } from "./modules/auth";
import { projectRoutes } from "./modules/projects";

const app = new Elysia()
  .use(cors()) // TODO: Restrict to specific domain
  .onError(({ error, status }) => {
    if (error instanceof NotFoundError) {
      return status(404, error.message);
    }
    return;
  })
  .use(authRoutes)
  .use(projectRoutes)
  .listen(3000);

console.log("Backend running on port", app.server?.port);
