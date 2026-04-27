import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "../db";
import * as authSchema from "../db/auth-schema";

export const auth = betterAuth({
  baseURL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
  secret: process.env["BETTER_AUTH_SECRET"] ?? "development-secret-change-me",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    github: {
      clientId: process.env["GITHUB_CLIENT_ID"] ?? "",
      clientSecret: process.env["GITHUB_CLIENT_SECRET"] ?? "",
    },
    gitlab: {
      clientId: process.env["GITLAB_CLIENT_ID"] ?? "",
      clientSecret: process.env["GITLAB_CLIENT_SECRET"] ?? "",
      issuer: "https://gitlab.ost.ch", // NOTE: This is currently OST specific
    },
    google: {
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    },
  },
});
