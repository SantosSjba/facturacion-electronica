import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: idColumn(),
    code: text("code").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    hash: text("hash").notNull(),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("legal_documents_code_version_uidx").on(t.code, t.version),
    check(
      "legal_documents_status_check",
      sql`${t.status} in ('draft', 'published')`,
    ),
  ],
);
