import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { databaseUrl } from "../env";
import * as schema from "./schema";

const client = new SQL(databaseUrl);

export const db = drizzle({ client, schema });

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type Db = Database | Transaction;
