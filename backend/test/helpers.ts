import { type Tx, db } from "../src/db";

class Rollback extends Error {
  constructor() {
    super("rollback");
    this.name = "Rollback";
  }
}

/**
 * Run `fn` inside a transaction that always rolls back. Use to isolate tests
 * from each other and from the dev database without manual cleanup.
 */
export async function withRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/**
 * Assert that `fn` throws an instance of `errorClass`. Returns the caught
 * error for further assertions. `expect(...).rejects` in `bun:test` is typed
 * loosely; this wrapper is precise.
 */
export async function expectThrows<E extends Error>(
  fn: () => Promise<unknown>,
  errorClass: new (...args: never[]) => E
): Promise<E> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof errorClass) return error;
    throw error;
  }
  throw new Error(`Expected ${errorClass.name} to be thrown, but nothing was thrown`);
}
