import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";

type Database = BunSQLDatabase<typeof schema> | PgliteDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Db = Database | Transaction;

class DbRegistry {
  private _db?: Database;

  set(db: Database): void {
    this._db = db;
  }

  get(): Database {
    if (!this._db) throw new Error("db not initialized, call dbRegistry.set() first");
    return this._db;
  }
}

export const dbRegistry = new DbRegistry();
