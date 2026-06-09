import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { frontendUrl } from "./env";
import { HttpError } from "./errors";
import { log } from "./logger";
import { authRoutes } from "./modules/auth";
import { blobRoutes } from "./modules/blobs";
import { collabRoutes } from "./modules/collab";
import { inviteRoutes } from "./modules/invites";
import { memberRoutes } from "./modules/members";
import { projectRoutes } from "./modules/projects";
import { templateRoutes } from "./modules/templates";

export function buildApp() {
  return new Elysia({ prefix: "/api" })
    .use(cors({ origin: new URL(frontendUrl).origin, credentials: true }))
    .onError(({ error, status, code, request }) => {
      // Expected, already-mapped failures: respond, don't log as a fault.
      if (error instanceof HttpError) return status(error.status, error.message);
      // Client-input errors (bad body, unknown route) are noise at error level.
      if (code === "VALIDATION" || code === "NOT_FOUND" || code === "PARSE") {
        log.warn({ code, method: request.method, url: request.url }, "Request rejected");
        return;
      }
      // Anything else is an unhandled server fault and would otherwise vanish.
      log.error(
        { err: error, code, method: request.method, url: request.url },
        "Unhandled request error"
      );
      return;
    })
    .use(authRoutes)
    .use(projectRoutes)
    .use(memberRoutes)
    .use(inviteRoutes)
    .use(templateRoutes)
    .use(blobRoutes)
    .use(collabRoutes);
}

export function startServer(port = 3000) {
  const app = buildApp().listen(port, ({ port: actualPort }) => {
    log.info(`Backend listening on port ${String(actualPort)}`);
  });
  return app;
}

export type App = ReturnType<typeof buildApp>;
