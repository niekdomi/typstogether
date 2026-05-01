import { user } from "./auth-schema";

export * from "./auth-schema";
export * from "./app-schema";

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
