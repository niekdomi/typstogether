function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const databaseUrl = required("DATABASE_URL");
export const collabPort = Number(process.env["COLLAB_PORT"] ?? 3001);

export const authBaseUrl = process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000";
export const authSecret = process.env["BETTER_AUTH_SECRET"] ?? "development-secret-change-me";

export const githubOAuth = {
  clientId: process.env["GITHUB_CLIENT_ID"] ?? "",
  clientSecret: process.env["GITHUB_CLIENT_SECRET"] ?? "",
};

export const googleOAuth = {
  clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
  clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
};

export const gitlabOAuth = {
  clientId: process.env["GITLAB_CLIENT_ID"] ?? "",
  clientSecret: process.env["GITLAB_CLIENT_SECRET"] ?? "",
  issuer: process.env["GITLAB_ISSUER"] ?? "https://gitlab.ost.ch",
};
