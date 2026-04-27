import { Elysia } from "elysia";
import { auth } from "./index";

export const sessionMiddleware = new Elysia({ name: "session-middleware" }).derive(
  { as: "scoped" },
  async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    return {
      user: session?.user ?? null,
      session: session?.session ?? null,
    };
  }
);
