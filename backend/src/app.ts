import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { frontendUrl } from "./env";
import { HttpError } from "./errors";
import { authRoutes } from "./modules/auth";
import { blobRoutes } from "./modules/blobs";
import { collabRoutes } from "./modules/collab";
import { fontRoutes } from "./modules/fonts";
import { inviteRoutes } from "./modules/invites";
import { memberRoutes } from "./modules/members";
import { projectRoutes } from "./modules/projects";
import { templateRoutes } from "./modules/templates";

export function buildApp() {
  return new Elysia({ prefix: "/api" })
    .use(cors({ origin: new URL(frontendUrl).origin, credentials: true }))
    .onError(({ error, status }) => {
      if (error instanceof HttpError) return status(error.status, error.message);
      return;
    })
    .use(authRoutes)
    .use(projectRoutes)
    .use(memberRoutes)
    .use(inviteRoutes)
    .use(templateRoutes)
    .use(blobRoutes)
    .use(fontRoutes)
    .use(collabRoutes);
}

export function startServer(port = 3000) {
  const app = buildApp().listen(port, ({ port: actualPort }) => {
    console.log("Backend running on port", actualPort);
  });
  return app;
}

export type App = ReturnType<typeof buildApp>;
