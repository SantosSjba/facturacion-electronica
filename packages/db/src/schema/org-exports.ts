import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";
import { organizations } from "./organizations";
import { users } from "./users";

export const orgExports = pgTable(
  "org_exports",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    objectKey: text("object_key"),
    error: text("error"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("org_exports_org_idx").on(t.organizationId),
    index("org_exports_status_idx").on(t.status),
    check(
      "org_exports_status_check",
      sql`${t.status} in ('queued', 'processing', 'ready', 'failed')`,
    ),
  ],
);
