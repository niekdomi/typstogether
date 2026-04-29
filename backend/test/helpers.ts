import { db } from "../src/db";
import { project, projectInvite, projectMember } from "../src/db/app-schema";
import { user } from "../src/db/auth-schema";

/**
 * Truncate all app tables. Use in `afterEach` to isolate tests from each other.
 * Order matters because of foreign keys; deleting from `user` first relies on
 * cascade rules covering everything downstream.
 */
export async function cleanDb(): Promise<void> {
  await db.delete(projectMember);
  await db.delete(projectInvite);
  await db.delete(project);
  await db.delete(user);
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
