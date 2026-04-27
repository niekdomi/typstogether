import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { auth } from "./auth";
import { startCollabServer } from "./collab/server";
import { projectRoutes } from "./routes/projects";

const app = new Elysia()
  .use(cors()) // TODO: Restrict to specific domain
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(projectRoutes)
  .listen(3000);

console.log("Backend running on port", app.server?.port);

startCollabServer();
