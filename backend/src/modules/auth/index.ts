import { Elysia, t } from "elysia";

import { githubOAuth, gitlabOAuth, googleOAuth } from "../../env";
import { auth } from "./service";

const providerModel = t.Object({ id: t.String(), name: t.String() });

const providers = [
  { id: "github", name: "GitHub", oauth: githubOAuth },
  { id: "gitlab", name: "GitLab", oauth: gitlabOAuth },
  { id: "google", name: "Google", oauth: googleOAuth },
]
  .filter(({ oauth }) => oauth.clientId !== "")
  .map(({ id, name }) => ({ id, name }));

export const authRoutes = new Elysia({ name: "auth-routes" })
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .get("/auth/providers", () => providers, { response: t.Array(providerModel) });
