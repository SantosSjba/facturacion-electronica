import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { organizations } from "./organizations";
import { plans } from "./plans";
import { users } from "./users";

export const planChangeRequests = pgTable(
  "plan_change_requests",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentPlanId: uuid("current_plan_id").references(() => plans.id, {
      onDelete: "set null",
    }),
    requestedPlanId: uuid("requested_plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("plan_change_requests_org_idx").on(t.organizationId),
    index("plan_change_requests_status_idx").on(t.status),
    check(
      "plan_change_requests_status_check",
      sql`${t.status} in ('pending', 'acknowledged', 'closed')`,
    ),
  ],
);
