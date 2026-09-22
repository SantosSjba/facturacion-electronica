import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";
import { organizations } from "./organizations";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: text("scopes").array().notNull(),
    status: text("status").notNull(),
    environmentConstraint: text("environment_constraint"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("api_keys_key_prefix_uidx").on(t.keyPrefix),
    index("api_keys_org_status_idx").on(t.organizationId, t.status),
    check("api_keys_status_check", sql`${t.status} in ('active', 'revoked')`),
    check(
      "api_keys_env_constraint_check",
      sql`${t.environmentConstraint} is null or ${t.environmentConstraint} in ('sandbox', 'production')`,
    ),
  ],
);
