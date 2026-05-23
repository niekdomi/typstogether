import { makeSignature } from "better-auth/crypto";
import { Elysia, t } from "elysia";

import { frontendUrl } from "../../env";
import { auth } from "../auth/service";

/**
 * Dev-only sign-in. Upserts a user by name, creates a Better Auth session,
 * sets the signed session cookie, and redirects to the dashboard.
 *
 * Mounted only from `dev.ts`, never from `app.ts`, so it physically can't
 * ship to prod. Hit from any browser/incognito window:
 *
 *   http://localhost:3000/api/dev/sign-in-as?name=Alice
 */
export const devRoutes = new Elysia({ name: "dev-routes" }).get(
  "/dev/sign-in-as",
  async ({ query, status }) => {
    const name = query.name.trim();
    if (!name) return status(400, "name is required");
    const email = `${name.toLowerCase()}@dev.test`;

    const ctx = await auth.$context;

    const existing = await ctx.internalAdapter.findUserByEmail(email);
    let userId = existing?.user.id;
    if (!userId) {
      const created = await ctx.internalAdapter.createUser({
        name,
        email,
        emailVerified: true,
      });
      userId = created.id;
    }

    const session = await ctx.internalAdapter.createSession(userId);
    const cookieName = ctx.authCookies.sessionToken.name;
    const cookieAttrs = ctx.authCookies.sessionToken.attributes;
    const signedValue = `${session.token}.${await makeSignature(session.token, ctx.secret)}`;

    const parts = [
      `${cookieName}=${signedValue}`,
      `Path=${cookieAttrs.path ?? "/"}`,
      "HttpOnly",
      `SameSite=${cookieAttrs.sameSite ?? "Lax"}`,
    ];
    if (cookieAttrs.maxAge !== undefined) parts.push(`Max-Age=${String(cookieAttrs.maxAge)}`);
    if (cookieAttrs.secure) parts.push("Secure");

    return new Response(null, {
      status: 302,
      headers: {
        location: `${frontendUrl}/dashboard`,
        "set-cookie": parts.join("; "),
      },
    });
  },
  {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 40 }) }),
  }
);
