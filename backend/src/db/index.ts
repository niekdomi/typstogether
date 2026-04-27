import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { databaseUrl } from "../env";
import * as schema from "./schema";

export const client = new SQL(databaseUrl);

export const db = drizzle({ client, schema });

export type Db = typeof db;
export { schema };
