import type { onAuthenticatePayload } from "@hocuspocus/server";

import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../errors";
import { auth } from "../auth/service";
import { projectService } from "../projects/service";

export async function onAuthenticate(data: onAuthenticatePayload): Promise<void> {
  const session = await auth.api.getSession({ headers: data.requestHeaders });

  if (!session) {
    throw new UnauthorizedError();
  }

  let membership;
  try {
    membership = await projectService.getMembership(session.user.id, data.documentName);
  } catch (e) {
    // getMembership throws NotFoundError for both missing projects and lack of access
    if (e instanceof NotFoundError) throw new ForbiddenError();
    throw e;
  }

  if (membership.role === "viewer") {
    data.connectionConfig.readOnly = true;
  }
}
