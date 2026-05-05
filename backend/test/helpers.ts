import { reset } from "drizzle-seed";

import { getDb } from "../src/db";
import * as schema from "../src/db/schema";

export async function cleanDb(): Promise<void> {
  await reset(getDb(), schema);
}

export function futureDate(offsetMs = 60 * 60 * 1000): Date {
  return new Date(Date.now() + offsetMs);
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
