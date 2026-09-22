import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { companies } from "./companies";
import { documents } from "./documents";
import { organizations } from "./organizations";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    requestPath: text("request_path").notNull(),
    status: text("status").notNull(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    responseCode: integer("response_code"),
    responseBody: jsonb("response_body"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("idempotency_keys_org_company_key_uidx").on(
      t.organizationId,
      t.companyId,
      t.key,
    ),
    index("idempotency_keys_expires_idx").on(t.expiresAt),
    check(
      "idempotency_keys_status_check",
      sql`${t.status} in ('in_progress', 'completed', 'expired')`,
    ),
  ],
);
