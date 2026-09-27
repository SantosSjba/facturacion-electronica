import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";
import { organizations } from "./organizations";
import { users } from "./users";

export const notifications = pgTable(
  "notifications",
  {
    id: idColumn(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    templateCode: text("template_code").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("notifications_org_idx").on(t.organizationId),
    index("notifications_user_idx").on(t.userId),
    check(
      "notifications_status_check",
      sql`${t.status} in ('pending', 'sent', 'failed')`,
    ),
  ],
);
