import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type SqlClient = ReturnType<typeof postgres>;

export function createSqlClient(connectionString: string): SqlClient {
  return postgres(connectionString, { max: 10, prepare: false });
}

export function createDb(connectionString: string) {
  const client = createSqlClient(connectionString);
  const db = drizzle(client, { schema });
  return Object.assign(db, { $client: client });
}

export type Db = ReturnType<typeof createDb>;
