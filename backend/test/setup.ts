import { afterAll } from "bun:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { dbRegistry } from "../src/db";
import * as schema from "../src/db/schema";

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: "./drizzle" });
dbRegistry.set(db);

afterAll(async () => {
  await client.close();
});
