import { relations } from "drizzle-orm";
import {
  customType,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const projectRole = pgEnum("project_role", ["editor", "viewer"]);
export const inviteRole = pgEnum("invite_role", ["editor", "viewer"]);

const bytea = customType<{
  data: Uint8Array;
  driverData: Uint8Array;
}>({
  dataType: () => "bytea",
});

const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const project = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [index("project_owner_user_id_idx").on(table.ownerUserId)]
);

export const projectMember = pgTable(
  "project_member",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: projectRole("role").notNull().default("editor"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("project_member_user_id_idx").on(table.userId),
  ]
);

export const projectInvite = pgTable(
  "project_invite",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: inviteRole("role").notNull().default("editor"),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("project_invite_token_hash_unique").on(table.tokenHash),
    index("project_invite_project_id_idx").on(table.projectId),
    index("project_invite_created_by_user_id_idx").on(table.createdByUserId),
  ]
);

export const collabDocument = pgTable(
  "collab_document",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    state: bytea("state").notNull(),
    ...timestamps,
  },
  (table) => [index("collab_document_updated_at_idx").on(table.updatedAt)]
);

export const projectRelations = relations(project, ({ one, many }) => ({
  owner: one(user, {
    fields: [project.ownerUserId],
    references: [user.id],
  }),
  members: many(projectMember),
  invites: many(projectInvite),
  collabDocument: one(collabDocument),
}));

export const projectMemberRelations = relations(projectMember, ({ one }) => ({
  project: one(project, {
    fields: [projectMember.projectId],
    references: [project.id],
  }),
  user: one(user, {
    fields: [projectMember.userId],
    references: [user.id],
  }),
}));

export const projectInviteRelations = relations(projectInvite, ({ one }) => ({
  project: one(project, {
    fields: [projectInvite.projectId],
    references: [project.id],
  }),
  createdBy: one(user, {
    fields: [projectInvite.createdByUserId],
    references: [user.id],
  }),
}));

export const collabDocumentRelations = relations(collabDocument, ({ one }) => ({
  project: one(project, {
    fields: [collabDocument.projectId],
    references: [project.id],
  }),
}));

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type ProjectMember = typeof projectMember.$inferSelect;
export type NewProjectMember = typeof projectMember.$inferInsert;
export type ProjectInvite = typeof projectInvite.$inferSelect;
export type NewProjectInvite = typeof projectInvite.$inferInsert;
export type CollabDocument = typeof collabDocument.$inferSelect;
export type NewCollabDocument = typeof collabDocument.$inferInsert;
