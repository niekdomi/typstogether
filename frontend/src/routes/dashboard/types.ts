import { api } from "../../lib/api";

type ProjectsResponse = Awaited<ReturnType<typeof api.projects.get>>;
export type Membership = NonNullable<ProjectsResponse["data"]>[number];
export type ProjectRow = Membership["project"];
export type Role = Membership["role"];

export type Tab = "owned" | "shared";
export type Sort = "modified" | "title";
