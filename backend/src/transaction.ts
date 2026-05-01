import { AsyncLocalStorage } from "node:async_hooks";

import { type Db, db as rootDb } from "./db";

const txStorage = new AsyncLocalStorage<Db>();

/** The DB for the current async context: active transaction if any, else root. */
export function currentDb(): Db {
  return txStorage.getStore() ?? rootDb;
}

/**
 * Runs `fn` in a transaction; `currentDb()` calls inside it see the tx.
 * Nested `withTx` calls become savepoints of the outer transaction.
 */
export function withTx<T>(fn: () => Promise<T>): Promise<T> {
  return currentDb().transaction((tx) => txStorage.run(tx, fn));
}
