import { Elysia } from "elysia";

import { UnauthorizedError } from "../../errors";
import { auth } from "./service";

export const authMacro = new Elysia({ name: "auth-macro" }).macro({
  auth: {
    resolve: async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session?.user) {
        throw new UnauthorizedError("Unauthorized");
      }

      return { user: session.user, session: session.session };
    },
  },
});
