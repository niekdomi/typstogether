import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";
import * as schema from "./schema";

const databaseUrl =
  process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@localhost:5432/typstogether";

export const client = new SQL(databaseUrl);

export const db = drizzle({ client, schema });

export type Db = typeof db;
export { schema };
