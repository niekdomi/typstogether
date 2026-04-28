import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";
import { databaseUrl } from "../env";
import * as schema from "./schema";

export const client = new SQL(databaseUrl);

export const db = drizzle({ client, schema });

export type Db = typeof db;
// eslint-disable-next-line unicorn/prefer-export-from
export { schema };
