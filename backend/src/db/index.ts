import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl =
  process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@localhost:5432/typstogether";

export const client = postgres(databaseUrl, {
  max: Number(process.env["DATABASE_POOL_SIZE"] ?? 10),
});

export const db = drizzle(client, { schema });

export type Db = typeof db;
export { schema };
