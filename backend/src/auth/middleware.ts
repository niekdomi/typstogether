import { Elysia, status } from "elysia";
import { auth } from "./index";

const sessionMiddleware = new Elysia({ name: "session-middleware" }).derive(
  { as: "scoped" },
  async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    return {
      user: session?.user ?? null,
      session: session?.session ?? null,
    };
  }
);

export const requireAuth = new Elysia({ name: "require-auth" })
  .use(sessionMiddleware)
  .resolve({ as: "scoped" }, ({ user, session }) => {
    if (!user || !session) {
      return status(401, "Unauthorized");
    }
    return { user, session };
  });
