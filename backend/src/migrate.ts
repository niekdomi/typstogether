import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { databaseUrl } from "./env";

if (!databaseUrl) throw new Error("DATABASE_URL required for migration");

const client = new SQL(databaseUrl);
const db = drizzle({ client });

await migrate(db, { migrationsFolder: "./drizzle" });
await client.close();
console.log("Migration complete");
