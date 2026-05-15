import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { dbRegistry } from "./db";
import * as schema from "./db/schema";

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: "./drizzle" });
dbRegistry.set(db);

const { startServer } = await import("./app");
const { startBlobSweeper } = await import("./modules/blobs/sweeper");

startServer();
startBlobSweeper();

// HACK: Without the following line, bun won't produce a `.cpuprofile` when running with `--cpu-prof`.
// This hack though has the issue that running `bun dev` no longer exists gracefully.
// FWIW, the backend exists with code 130.
// This issue is likely related: https://github.com/oven-sh/bun/issues/24787
// process.on("SIGINT", () => process.exit(0));
