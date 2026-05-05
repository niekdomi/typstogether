import { AsyncLocalStorage } from "node:async_hooks";

import { type Db, dbRegistry } from "./db";

const transactionStorage = new AsyncLocalStorage<Db>();

/** The DB for the current async context: active transaction if any, else root. */
export function currentDb(): Db {
  return transactionStorage.getStore() ?? dbRegistry.get();
}
