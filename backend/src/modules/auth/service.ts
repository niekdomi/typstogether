import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { db } from "../../db";
import * as authSchema from "../../db/auth-schema";
import { authBaseUrl, authSecret, githubOAuth, gitlabOAuth, googleOAuth } from "../../env";

export const auth = betterAuth({
  baseURL: authBaseUrl,
  secret: authSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    github: githubOAuth,
    gitlab: gitlabOAuth,
    google: googleOAuth,
  },
});
