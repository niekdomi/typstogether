import { reset } from "drizzle-seed";

import { db } from "../src/db";
import * as schema from "../src/db/schema";

/** Truncate every table in the schema (TRUNCATE CASCADE under the hood). */
export async function cleanDb(): Promise<void> {
  await reset(db, schema);
}

/**
 * Assert that `fn` throws an instance of `errorClass`. Returns the caught
 * error for further property assertions. Wraps around `expect(...).rejects`
 * which is typed as `void` in `bun:test` and trips
 * `@typescript-eslint/no-confusing-void-expression` when awaited.
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
