import { sql } from "drizzle-orm";
import { char, check, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { organizations } from "./organizations";

export interface CompanyLogo {
  objectKey: string;
  contentType: "image/png";
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  updatedAt: string;
}

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
    pdfFormat: text("pdf_format")
      .$type<"A4" | "A5" | "TICKET80" | "TICKET58">()
      .notNull()
      .default("A4"),
    taxAgentSettings: jsonb("tax_agent_settings")
      .$type<{ retention: boolean; perception_regimes: ("01" | "02" | "03")[] }>()
      .notNull()
      .default(sql`'{"retention":false,"perception_regimes":[]}'::jsonb`),
    logo: jsonb("logo").$type<CompanyLogo>(),
    environment: text("environment").notNull().default("sandbox"),
    address: jsonb("address"),
    catalogPin: jsonb("catalog_pin")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    timezone: text("timezone").notNull().default("America/Lima"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("companies_org_ruc_env_uidx").on(t.organizationId, t.ruc, t.environment),
    index("companies_org_id_idx").on(t.organizationId, t.id),
    index("companies_org_status_idx").on(t.organizationId, t.status),
    check("companies_environment_check", sql`${t.environment} in ('sandbox', 'production')`),
    check(
      "companies_pdf_format_check",
      sql`${t.pdfFormat} in ('A4', 'A5', 'TICKET80', 'TICKET58')`,
    ),
    check("companies_ruc_len_check", sql`char_length(${t.ruc}) = 11`),
    check("companies_status_check", sql`${t.status} in ('active', 'disabled')`),
  ],
);
