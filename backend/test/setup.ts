import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../src/db/schema";

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: "./drizzle" });

await mock.module("../src/db", () => ({
  db,
}));
