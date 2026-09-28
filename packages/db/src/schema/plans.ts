import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";

export const plans = pgTable(
  "plans",
  {
    id: idColumn(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    priceMonthlyCents: integer("price_monthly_cents").notNull().default(0),
    priceDisplay: text("price_display").notNull().default(""),
    currency: text("currency").notNull().default("PEN"),
    isActive: boolean("is_active").notNull().default(true),
    maxCompanies: integer("max_companies").notNull().default(1),
    maxUsers: integer("max_users").notNull().default(2),
    maxDocumentsPerMonth: integer("max_documents_per_month").notNull().default(100),
    maxApiKeys: integer("max_api_keys").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("plans_code_uidx").on(t.code),
    check("plans_currency_len", sql`char_length(${t.currency}) = 3`),
    check("plans_max_companies_nonneg", sql`${t.maxCompanies} >= 0`),
    check("plans_max_users_nonneg", sql`${t.maxUsers} >= 0`),
    check(
      "plans_max_documents_per_month_nonneg",
      sql`${t.maxDocumentsPerMonth} >= 0`,
    ),
    check("plans_max_api_keys_nonneg", sql`${t.maxApiKeys} >= 0`),
  ],
);
