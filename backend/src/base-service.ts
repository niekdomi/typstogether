import { AsyncLocalStorage } from "node:async_hooks";

import type { Db } from "./db";

const txStorage = new AsyncLocalStorage<Db>();

export abstract class BaseService {
  constructor(private readonly rootDb: Db) {}

  protected get db(): Db {
    return txStorage.getStore() ?? this.rootDb;
  }

  protected withTx<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => txStorage.run(tx, fn));
  }
}
