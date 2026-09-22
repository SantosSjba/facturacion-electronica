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

import { citext } from "./citext";
import { createdAt, idColumn, updatedAt } from "./columns";
import { organizations } from "./organizations";

export const users = pgTable(
  "users",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: citext("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_org_email_uidx").on(t.organizationId, t.email),
    index("users_org_status_idx").on(t.organizationId, t.status),
    check("users_status_check", sql`${t.status} in ('active', 'disabled')`),
  ],
);
