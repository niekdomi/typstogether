import { Elysia } from "elysia";

import { auth } from "./service";

export const authRoutes = new Elysia({ name: "auth-routes" }).all("/api/auth/*", ({ request }) =>
  auth.handler(request)
);
