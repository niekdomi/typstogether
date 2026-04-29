import { type Tx } from "../src/db";
import { type NewProject, type Project, project } from "../src/db/app-schema";
import { user } from "../src/db/auth-schema";

type NewUser = typeof user.$inferInsert;
type User = typeof user.$inferSelect;

export async function createUser(tx: Tx, overrides: Partial<NewUser> = {}): Promise<User> {
  const id = crypto.randomUUID();
  const [inserted] = await tx
    .insert(user)
    .values({
      id,
      name: `Test ${id.slice(0, 8)}`,
      email: `${id}@example.test`,
      ...overrides,
    })
    .returning();
  if (!inserted) throw new Error("Factory: failed to insert user");
  return inserted;
}

export async function createProject(
  tx: Tx,
  ownerUserId: string,
  overrides: Partial<NewProject> = {}
): Promise<Project> {
  const [inserted] = await tx
    .insert(project)
    .values({
      name: `Test project ${crypto.randomUUID().slice(0, 8)}`,
      ownerUserId,
      ...overrides,
    })
    .returning();
  if (!inserted) throw new Error("Factory: failed to insert project");
  return inserted;
}
