import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { dbRegistry } from "../../db";
import * as authSchema from "../../db/auth-schema";
import {
  authBaseUrl,
  authSecret,
  frontendUrl,
  githubOAuth,
  gitlabOAuth,
  googleOAuth,
} from "../../env";

export const auth = betterAuth({
  baseURL: authBaseUrl,
  secret: authSecret,
  trustedOrigins: [frontendUrl],
  database: drizzleAdapter(dbRegistry.get(), {
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
