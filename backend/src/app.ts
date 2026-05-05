import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { HttpError } from "./errors";
import { authRoutes } from "./modules/auth";
import { startCollabServer } from "./modules/collab/server";
import { inviteRoutes } from "./modules/invites";
import { memberRoutes } from "./modules/members";
import { projectRoutes } from "./modules/projects";

export function buildApp() {
  return new Elysia()
    .use(cors()) // TODO: Restrict to specific domain
    .onError(({ error, status }) => {
      if (error instanceof HttpError) return status(error.status, error.message);
      return;
    })
    .use(authRoutes)
    .use(projectRoutes)
    .use(memberRoutes)
    .use(inviteRoutes);
}

export function startServer(port = 3000) {
  const app = buildApp().listen(port);
  console.log("Backend running on port", app.server?.port);
  startCollabServer();
  return app;
}

export type App = ReturnType<typeof buildApp>;
