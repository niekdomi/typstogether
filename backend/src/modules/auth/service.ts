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
import { log } from "../../logger";

const authLog = log.child({ module: "better-auth" });

export const auth = betterAuth({
  baseURL: authBaseUrl,
  secret: authSecret,
  trustedOrigins: [frontendUrl],
  // Route Better Auth logs through pino so everything is one consistent format.
  logger: {
    log(level, message, ...args) {
      authLog[level](args.length > 0 ? { args } : {}, message);
    },
  },
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
