import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { companies } from "./companies";
import { organizations } from "./organizations";

export const credentials = pgTable(
  "credentials",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    secretRef: text("secret_ref").notNull(),
    publicMetadata: jsonb("public_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    rotatedAt: timestamp("rotated_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("credentials_company_kind_uidx").on(t.companyId, t.kind),
    index("credentials_org_company_idx").on(t.organizationId, t.companyId),
    check(
      "credentials_kind_check",
      sql`${t.kind} in ('certificate', 'sol', 'gre')`,
    ),
    check(
      "credentials_status_check",
      sql`${t.status} in ('active', 'expired', 'revoked', 'missing')`,
    ),
  ],
);
