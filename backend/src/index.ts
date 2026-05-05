import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { setDb } from "./db";
import * as schema from "./db/schema";
import { databaseUrl } from "./env";

if (!databaseUrl) throw new Error("DATABASE_URL required for production entry");

const client = new SQL(databaseUrl);
setDb(drizzle({ client, schema }));

const { startServer } = await import("./app");
startServer();

export type { App } from "./app";
