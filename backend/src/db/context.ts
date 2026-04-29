import { AsyncLocalStorage } from "node:async_hooks";

import { type Db, type Tx, db as defaultDb } from "./index";

const txStore = new AsyncLocalStorage<Tx>();

export function currentDb(): Db | Tx {
  return txStore.getStore() ?? defaultDb;
}

export async function withTx<T>(fn: () => Promise<T>): Promise<T> {
  return await defaultDb.transaction((tx) => txStore.run(tx, fn));
}
