export const databaseUrl = process.env["DATABASE_URL"] ?? "";

export const authBaseUrl = process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000";
export const authSecret = process.env["BETTER_AUTH_SECRET"] ?? "development-secret-change-me";
export const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:5173";

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
