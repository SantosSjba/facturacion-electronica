import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { organizations } from "./organizations";

export const companies = pgTable(
  "companies",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ruc: char("ruc", { length: 11 }).notNull(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    environment: text("environment").notNull().default("sandbox"),
    address: jsonb("address"),
    catalogPin: jsonb("catalog_pin")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    timezone: text("timezone").notNull().default("America/Lima"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("companies_org_ruc_env_uidx").on(
      t.organizationId,
      t.ruc,
      t.environment,
    ),
    index("companies_org_id_idx").on(t.organizationId, t.id),
    check(
      "companies_environment_check",
      sql`${t.environment} in ('sandbox', 'production')`,
    ),
    check("companies_ruc_len_check", sql`char_length(${t.ruc}) = 11`),
  ],
);
