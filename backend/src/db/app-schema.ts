import { relations, sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const projectRole = pgEnum("project_role", ["owner", "editor"]);
export const inviteRole = pgEnum("invite_role", ["editor"]);

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

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("projects_slug_unique").on(table.slug),
    index("projects_owner_user_id_idx").on(table.ownerUserId),
  ]
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: projectRole("role").notNull().default("editor"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("project_members_user_id_idx").on(table.userId),
  ]
);

export const projectInvites = pgTable(
  "project_invites",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: inviteRole("role").notNull().default("editor"),
    expiresAt: timestamp("expires_at").notNull(),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    revokedAt: timestamp("revoked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("project_invites_token_hash_unique").on(table.tokenHash),
    index("project_invites_project_id_idx").on(table.projectId),
    index("project_invites_created_by_user_id_idx").on(table.createdByUserId),
    check(
      "project_invites_max_uses_positive_check",
      sql`${table.maxUses} is null or ${table.maxUses} > 0`
    ),
    check("project_invites_use_count_non_negative_check", sql`${table.useCount} >= 0`),
  ]
);

export const collabDocuments = pgTable(
  "collab_documents",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    state: bytea("state").notNull(),
    ...timestamps,
  },
  (table) => [index("collab_documents_updated_at_idx").on(table.updatedAt)]
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(user, {
    fields: [projects.ownerUserId],
    references: [user.id],
  }),
  members: many(projectMembers),
  invites: many(projectInvites),
  collabDocument: one(collabDocuments),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(user, {
    fields: [projectMembers.userId],
    references: [user.id],
  }),
}));

export const projectInvitesRelations = relations(projectInvites, ({ one }) => ({
  project: one(projects, {
    fields: [projectInvites.projectId],
    references: [projects.id],
  }),
  createdBy: one(user, {
    fields: [projectInvites.createdByUserId],
    references: [user.id],
  }),
}));

export const collabDocumentsRelations = relations(collabDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [collabDocuments.projectId],
    references: [projects.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectInvite = typeof projectInvites.$inferSelect;
export type NewProjectInvite = typeof projectInvites.$inferInsert;
export type CollabDocument = typeof collabDocuments.$inferSelect;
export type NewCollabDocument = typeof collabDocuments.$inferInsert;
