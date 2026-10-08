import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { organizations } from "./organizations";
import { plans } from "./plans";
import { orgPlans } from "./org-plans";
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
    resolution: text("resolution"),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedOrgPlanId: uuid("assigned_org_plan_id").references(() => orgPlans.id, {
      onDelete: "set null",
    }),
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
    check(
      "plan_change_requests_resolution_check",
      sql`${t.resolution} is null or (${t.status} = 'closed' and ${t.resolution} in ('approved', 'rejected'))`,
    ),
  ],
);
