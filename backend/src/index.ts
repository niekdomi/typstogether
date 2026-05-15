import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { dbRegistry } from "./db";
import * as schema from "./db/schema";
import { databaseUrl } from "./env";

if (!databaseUrl) throw new Error("DATABASE_URL required for production entry");

const client = new SQL(databaseUrl);
dbRegistry.set(drizzle({ client, schema }));

const { startServer } = await import("./app");
startServer();

export type { App } from "./app";
export type { ProviderId } from "./modules/auth/model";
