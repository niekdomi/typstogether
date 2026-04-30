import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { project } from "../src/db/app-schema";
import { user } from "../src/db/auth-schema";
import { type Project, type User } from "../src/db/schema";
import { currentDb } from "../src/tx";

export const userFactory = Factory.define<User, never, Promise<User>>(({ onCreate, sequence }) => {
  onCreate(async (u) => {
    const [row] = await currentDb().insert(user).values(u).returning();
    if (!row) throw new Error("userFactory: insert failed");
    return row;
  });

  return {
    id: crypto.randomUUID(),
    name: faker.person.fullName(),
    email: `user-${String(sequence)}@example.test`,
    emailVerified: false,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

export const projectFactory = Factory.define<Project, never, Promise<Project>>(({ onCreate }) => {
  onCreate(async (p) => {
    const [row] = await currentDb().insert(project).values(p).returning();
    if (!row) throw new Error("projectFactory: insert failed");
    return row;
  });

  return {
    id: crypto.randomUUID(),
    name: faker.commerce.productName(),
    ownerUserId: "",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
