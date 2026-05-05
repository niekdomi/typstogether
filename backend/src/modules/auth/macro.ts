import { Elysia } from "elysia";

import { UnauthorizedError } from "../../errors";
import { auth } from "./service";

export type GetSession = (headers: Headers) => ReturnType<typeof auth.api.getSession>;

const productionGetSession: GetSession = (headers) => auth.api.getSession({ headers });

export const authMacro = new Elysia({ name: "auth-macro" })
  .decorate("getSession", productionGetSession)
  .macro({
    auth: {
      resolve: async ({ request, getSession }) => {
        const session = await getSession(request.headers);
        if (!session?.user) throw new UnauthorizedError("Unauthorized");
        return { user: session.user, session: session.session };
      },
    },
  });
