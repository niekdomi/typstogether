import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { HttpError } from "./errors";
import { authRoutes } from "./modules/auth";
import { collabWs } from "./modules/collab/server";
import { inviteRoutes } from "./modules/invites";
import { memberRoutes } from "./modules/members";
import { projectRoutes } from "./modules/projects";
import { templateRoutes } from "./modules/templates";

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
    .use(inviteRoutes)
    .use(templateRoutes);
}

export function startServer(port = 3000) {
  const app = buildApp();
  const server = Bun.serve({
    port,
    websocket: collabWs.websocket,
    fetch(request, srv) {
      if (request.headers.get("upgrade") === "websocket") {
        return collabWs.handleUpgrade(request, srv);
      }
      return app.handle(request);
    },
  });
  console.log("Backend running on port", server.port);
  return app;
}

export type App = ReturnType<typeof buildApp>;
