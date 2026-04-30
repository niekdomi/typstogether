import { AsyncLocalStorage } from "node:async_hooks";

import { type Db, db as rootDb } from "./db";

const txStorage = new AsyncLocalStorage<Db>();

/** The DB for the current async context: active transaction if any, else root. */
export function currentDb(): Db {
  return txStorage.getStore() ?? rootDb;
}

/**
 * Run `fn` inside a transaction. Nested calls join the surrounding tx as a
 * checkpoint. Throwing from `fn` rolls back. Service methods that read the DB
 * via `currentDb()` automatically pick up the tx.
 */
export function withTx<T>(fn: () => Promise<T>): Promise<T> {
  return currentDb().transaction((tx) => txStorage.run(tx, fn));
}
