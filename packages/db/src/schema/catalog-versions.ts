import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";

export const catalogVersions = pgTable(
  "catalog_versions",
  {
    id: idColumn(),
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    sourceFilename: text("source_filename"),
    sourceSha256: text("source_sha256").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    isDefault: boolean("is_default").notNull().default(false),
    artifactPath: text("artifact_path").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("catalog_versions_kind_version_uidx").on(t.kind, t.version),
    uniqueIndex("catalog_versions_kind_default_uidx")
      .on(t.kind)
      .where(sql`${t.isDefault} = true`),
    check(
      "catalog_versions_kind_check",
      sql`${t.kind} in ('ruleset_excel', 'anexo_vii', 'rs340', 'codigos_retorno', 'ubigeo', 'other')`,
    ),
  ],
);
