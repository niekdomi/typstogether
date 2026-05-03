import type { onAuthenticatePayload } from "@hocuspocus/server";

import { UnauthorizedError } from "../../errors";
import { auth } from "../auth/service";
import { authorizeCollab } from "./authorization";

export async function onAuthenticate(data: onAuthenticatePayload): Promise<void> {
  const session = await auth.api.getSession({ headers: data.requestHeaders });

  if (!session) throw new UnauthorizedError();

  const { readOnly } = await authorizeCollab(session.user.id, data.documentName);
  if (readOnly) {
    data.connectionConfig.readOnly = true;
  }
}
