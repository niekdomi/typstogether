import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";

type Database = BunSQLDatabase<typeof schema> | PgliteDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Db = Database | Transaction;

let _db: Database | undefined;

export function setDb(db: Database): void {
  _db = db;
}

export function getDb(): Database {
  if (!_db) throw new Error("db not initialized — call setDb() first");
  return _db;
}
