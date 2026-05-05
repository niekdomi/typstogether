import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { setDb } from "./db";
import * as schema from "./db/schema";

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: "./drizzle" });
setDb(db);

const { startServer } = await import("./app");
startServer();
