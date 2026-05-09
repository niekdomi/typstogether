import { Elysia, t } from "elysia";

import { githubOAuth, gitlabOAuth, googleOAuth } from "../../env";
import { providerModel } from "./model";
import { auth } from "./service";

const providers = [
  { id: "github" as const, name: "GitHub", oauth: githubOAuth },
  { id: "gitlab" as const, name: "GitLab", oauth: gitlabOAuth },
  { id: "google" as const, name: "Google", oauth: googleOAuth },
]
  .filter(({ oauth }) => oauth.clientId !== "")
  .map(({ id, name }) => ({ id, name }));

export const authRoutes = new Elysia({ name: "auth-routes" })
  .all("/auth/*", ({ request }) => auth.handler(request))
  .get("/auth/providers", () => providers, { response: t.Array(providerModel) });
