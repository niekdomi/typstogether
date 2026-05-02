import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { HttpError } from "./errors";
import { authRoutes } from "./modules/auth";
import { inviteRoutes } from "./modules/invites";
import { memberRoutes } from "./modules/members";
import { projectRoutes } from "./modules/projects";

const app = new Elysia()
  .use(cors()) // TODO: Restrict to specific domain
  .onError(({ error, status }) => {
    if (error instanceof HttpError) return status(error.status, error.message);
    return;
  })
  .use(authRoutes)
  .use(projectRoutes)
  .use(memberRoutes)
  .use(inviteRoutes)
  .listen(3000);

console.log("Backend running on port", app.server?.port);
