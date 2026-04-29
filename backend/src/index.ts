import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { ForbiddenError, GoneError, NotFoundError, UnauthorizedError } from "./errors";
import { authRoutes } from "./modules/auth";
import { inviteRoutes } from "./modules/invites";
import { projectRoutes } from "./modules/projects";

const app = new Elysia()
  .use(cors()) // TODO: Restrict to specific domain
  .onError(({ error, status }) => {
    if (error instanceof NotFoundError) return status(404, error.message);
    if (error instanceof ForbiddenError) return status(403, error.message);
    if (error instanceof UnauthorizedError) return status(401, error.message);
    if (error instanceof GoneError) return status(410, error.message);
    return;
  })
  .use(authRoutes)
  .use(projectRoutes)
  .use(inviteRoutes)
  .listen(3000);

console.log("Backend running on port", app.server?.port);
