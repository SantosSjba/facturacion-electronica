import { sql } from "drizzle-orm";
import {
  char,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { companies } from "./companies";
import { organizations } from "./organizations";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    events: text("events").array().notNull(),
    status: text("status").notNull().default("active"),
    secretHash: text("secret_hash").notNull(),
    secretEncrypted: bytea("secret_encrypted"),
    secretHint: char("secret_hint", { length: 4 }).notNull(),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    disabledAt: timestamp("disabled_at", { withTimezone: true, mode: "date" }),
    lastSuccessAt: timestamp("last_success_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("webhook_endpoints_org_status_idx").on(t.organizationId, t.status),
    check(
      "webhook_endpoints_status_check",
      sql`${t.status} in ('active', 'disabled')`,
    ),
  ],
);
