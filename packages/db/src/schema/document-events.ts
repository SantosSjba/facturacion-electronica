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

import { idColumn } from "./columns";
import { companies } from "./companies";
import { documents } from "./documents";
import { organizations } from "./organizations";

export const documentEvents = pgTable(
  "document_events",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    status: text("status").notNull(),
    fromStatus: text("from_status"),
    detail: text("detail"),
    source: text("source").notNull(),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    index("document_events_document_at_idx").on(t.documentId, t.at),
    index("document_events_tenancy_at_idx").on(
      t.organizationId,
      t.companyId,
      t.at,
    ),
    check(
      "document_events_source_check",
      sql`${t.source} in ('api', 'worker', 'sunat', 'system')`,
    ),
  ],
);
