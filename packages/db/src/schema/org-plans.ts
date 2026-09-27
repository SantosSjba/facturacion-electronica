import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";
import { organizations } from "./organizations";
import { plans } from "./plans";

export const orgPlans = pgTable(
  "org_plans",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("trialing"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("org_plans_org_idx").on(t.organizationId),
    check(
      "org_plans_status_check",
      sql`${t.status} in ('trialing', 'active', 'canceled')`,
    ),
  ],
);
