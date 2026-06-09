import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { databaseUrl } from "./env";
import { log } from "./logger";

if (!databaseUrl) throw new Error("DATABASE_URL required for migration");

const client = new SQL(databaseUrl);
const db = drizzle({ client });

await migrate(db, { migrationsFolder: "./drizzle" });
await client.close();
log.info("migration complete");
