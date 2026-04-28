import { Elysia, status } from "elysia";
import { auth } from "./service";

export const authMacro = new Elysia({ name: "auth-macro" }).macro({
  auth: {
    resolve: async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session?.user) {
        return status(401, "Unauthorized");
      }

      return { user: session.user, session: session.session };
    },
  },
});
