import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { databaseUrl } from "../env";
import * as schema from "./schema";

const client = new SQL(databaseUrl);

export const db = drizzle({ client, schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
