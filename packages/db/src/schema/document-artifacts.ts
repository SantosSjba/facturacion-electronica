import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";
import { companies } from "./companies";
import { documents } from "./documents";
import { organizations } from "./organizations";

export const documentArtifacts = pgTable(
  "document_artifacts",
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
    kind: text("kind").notNull(),
    storageBackend: text("storage_backend").notNull().default("s3"),
    bucket: text("bucket"),
    objectKey: text("object_key"),
    contentType: text("content_type"),
    sha256: text("sha256").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    encryption: text("encryption"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("document_artifacts_document_kind_uidx").on(t.documentId, t.kind),
    index("document_artifacts_tenancy_idx").on(
      t.organizationId,
      t.companyId,
      t.documentId,
    ),
    check(
      "document_artifacts_kind_check",
      sql`${t.kind} in ('request_json', 'xml_unsigned', 'xml_signed', 'zip', 'cdr_xml', 'pdf', 'other')`,
    ),
    check(
      "document_artifacts_storage_check",
      sql`${t.storageBackend} in ('s3', 'db')`,
    ),
  ],
);
