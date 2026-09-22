import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";

export const organizations = pgTable(
  "organizations",
  {
    id: idColumn(),
    name: text("name").notNull(),
    slug: text("slug"),
    status: text("status").notNull().default("active"),
    rateLimitRpm: integer("rate_limit_rpm"),
    ipAllowlist: jsonb("ip_allowlist").$type<string[] | null>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("organizations_slug_uidx").on(t.slug).where(sql`${t.slug} is not null`),
    check(
      "organizations_status_check",
      sql`${t.status} in ('active', 'suspended')`,
    ),
  ],
);
