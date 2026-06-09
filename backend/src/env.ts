const env = (key: string): string | undefined => {
  const value = process.env[key];
  return value === "" ? undefined : value;
};

export const databaseUrl = env("DATABASE_URL") ?? "";

export const authBaseUrl = env("BETTER_AUTH_URL") ?? "http://localhost:3000";
export const authSecret = env("BETTER_AUTH_SECRET") ?? "development-secret-change-me";
export const frontendUrl = env("FRONTEND_URL") ?? "http://localhost:5173";

export const logLevel = env("LOG_LEVEL") ?? "info";

export const githubOAuth = {
  clientId: env("GITHUB_CLIENT_ID") ?? "",
  clientSecret: env("GITHUB_CLIENT_SECRET") ?? "",
};

export const googleOAuth = {
  clientId: env("GOOGLE_CLIENT_ID") ?? "",
  clientSecret: env("GOOGLE_CLIENT_SECRET") ?? "",
};

export const gitlabOAuth = {
  clientId: env("GITLAB_CLIENT_ID") ?? "",
  clientSecret: env("GITLAB_CLIENT_SECRET") ?? "",
  issuer: env("GITLAB_ISSUER") ?? "https://gitlab.ost.ch",
};
