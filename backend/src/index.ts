import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import {
  ConflictError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  UnauthorizedError,
} from "./errors";
import { authRoutes } from "./modules/auth";
import { inviteRoutes } from "./modules/invites";
import { memberRoutes } from "./modules/members";
import { projectRoutes } from "./modules/projects";

const app = new Elysia()
  .use(cors()) // TODO: Restrict to specific domain
  .onError(({ error, status }) => {
    if (error instanceof NotFoundError) return status(404, error.message);
    if (error instanceof ForbiddenError) return status(403, error.message);
    if (error instanceof UnauthorizedError) return status(401, error.message);
    if (error instanceof GoneError) return status(410, error.message);
    if (error instanceof ConflictError) return status(409, error.message);
    return;
  })
  .use(authRoutes)
  .use(projectRoutes)
  .use(memberRoutes)
  .use(inviteRoutes)
  .listen(3000);

console.log("Backend running on port", app.server?.port);
