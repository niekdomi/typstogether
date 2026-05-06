export type Tab = "owned" | "shared" | "templates" | "trash";
export type Sort = "modified" | "title";
export type Role = "owner" | "editor" | "viewer";

export interface ProjectRow {
  id: string;
  name: string;
  ownerUserId: string;
  deletedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Membership {
  project: ProjectRow;
  role: Role;
}
