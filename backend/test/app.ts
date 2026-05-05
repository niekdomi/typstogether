import { type AnyElysia, Elysia } from "elysia";

import { type User } from "../src/db/schema";
import { HttpError } from "../src/errors";
import { type GetSession } from "../src/modules/auth/macro";

let currentTestUser: User | null = null;

export const setTestUser = (user: User | null): void => {
  currentTestUser = user;
};

const testGetSession: GetSession = () => {
  if (!currentTestUser) return Promise.resolve(null);
  return Promise.resolve({
    user: currentTestUser,
    session: {
      id: "test-session",
      userId: currentTestUser.id,
      token: "test-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const buildTestApp = (routes: AnyElysia) =>
  new Elysia()
    .decorate("getSession", testGetSession)
    .onError(({ error, status }) => {
      if (error instanceof HttpError) return status(error.status, error.message);
      return;
    })
    .use(routes);

export const requestOn =
  (app: AnyElysia) =>
  (path: string, init?: RequestInit): Promise<Response> =>
    app.handle(new Request(`http://localhost${path}`, init));

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
