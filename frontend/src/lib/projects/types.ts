import type { api } from "../api";

type ProjectsResponse = Awaited<ReturnType<typeof api.projects.get>>;

/** A dashboard list row: the membership plus the project's content-version. */
export type Membership = NonNullable<ProjectsResponse["data"]>[number];

type ProjectResponse = Awaited<ReturnType<ReturnType<typeof api.projects>["get"]>>;
/** The single-project detail from `GET /:id` (no `docUpdatedAt`). */
export type ProjectDetail = NonNullable<ProjectResponse["data"]>;

export type ProjectRow = Membership["project"];
export type Role = Membership["role"];
