import { reset } from "drizzle-seed";

import { db } from "../src/db";
import * as schema from "../src/db/schema";

export async function cleanDb(): Promise<void> {
  await reset(db, schema);
}

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
