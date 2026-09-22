import { uuidv7 } from "uuidv7";

export { createDb, createSqlClient, type Db, type SqlClient } from "./client";
export { DB } from "./tokens";
export * from "./schema";
export { seedDemo } from "./seeds/demo";

/** Preferred public PK generator (doc 26 §1). */
export function newId(): string {
  return uuidv7();
}
