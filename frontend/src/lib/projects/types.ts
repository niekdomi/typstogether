import type { api } from "../api";

type ProjectsResponse = Awaited<ReturnType<typeof api.projects.get>>;

/** A user's membership in a project, including the project itself and the user's role. */
export type Membership = NonNullable<ProjectsResponse["data"]>[number];
export type ProjectRow = Membership["project"];
export type Role = Membership["role"];
