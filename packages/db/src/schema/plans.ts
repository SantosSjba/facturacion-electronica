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
    currency: text("currency").notNull().default("PEN"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("plans_code_uidx").on(t.code),
    check("plans_currency_len", sql`char_length(${t.currency}) = 3`),
  ],
);
