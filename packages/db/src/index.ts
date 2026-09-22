import { uuidv7 } from "uuidv7";

export { createDb, createSqlClient, type Db, type SqlClient } from "./client";
export { DB } from "./tokens";
export * from "./schema";
export {
  seedDemo,
  DEMO_ORG_SLUG,
  DEMO_OWNER_EMAIL,
  DEMO_OWNER_PASSWORD,
  DEMO_VIEWER_EMAIL,
  DEMO_VIEWER_PASSWORD,
  RULESET_VERSION,
  RULESET_SHA256,
  RULESET_ARTIFACT,
} from "./seeds/demo";
export {
  seedRbacMatrix,
  PERMISSION_CODES,
  ROLE_DEFS,
  ROLE_PERMISSION_MATRIX,
} from "./seeds/rbac-matrix";
export type { PermissionCode, RoleCode } from "./seeds/rbac-matrix";

/** Preferred public PK generator (doc 26 §1). */
export function newId(): string {
  return uuidv7();
}
