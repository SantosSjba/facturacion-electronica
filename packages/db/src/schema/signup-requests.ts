import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { citext } from "./citext";
import { createdAt, idColumn, updatedAt } from "./columns";
import { organizations } from "./organizations";

export const signupRequests = pgTable(
  "signup_requests",
  {
    id: idColumn(),
    companyName: text("company_name").notNull(),
    ruc: text("ruc").notNull(),
    contactEmail: citext("contact_email").notNull(),
    contactName: text("contact_name").notNull(),
    planCode: text("plan_code"),
    status: text("status").notNull().default("received"),
    notes: text("notes"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("signup_requests_status_idx").on(t.status),
    check(
      "signup_requests_status_check",
      sql`${t.status} in ('received', 'under_review', 'approved', 'rejected')`,
    ),
  ],
);
