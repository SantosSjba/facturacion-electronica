import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { companies } from "./companies";
import { organizations } from "./organizations";

export const documentSeries = pgTable(
  "document_series",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    serie: text("serie").notNull(),
    nextNumber: bigint("next_number", { mode: "number" }).notNull().default(1),
    padding: integer("padding").notNull().default(8),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("document_series_company_type_serie_uidx").on(
      t.companyId,
      t.documentType,
      t.serie,
    ),
    index("document_series_org_company_idx").on(t.organizationId, t.companyId),
    check("document_series_next_number_check", sql`${t.nextNumber} >= 1`),
    check("document_series_padding_check", sql`${t.padding} >= 1`),
  ],
);
