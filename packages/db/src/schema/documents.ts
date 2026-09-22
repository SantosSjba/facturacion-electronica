import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { companies } from "./companies";
import { organizations } from "./organizations";

export const DOCUMENT_STATUSES = [
  "draft",
  "validated",
  "queued",
  "sent",
  "ticket_pending",
  "accepted",
  "accepted_with_observation",
  "rejected",
  "failed",
  "cancelled",
] as const;

export const documents = pgTable(
  "documents",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    serie: text("serie"),
    number: bigint("number", { mode: "number" }),
    serieNumber: text("serie_number"),
    status: text("status").notNull(),
    environment: text("environment").notNull(),
    issueDate: date("issue_date"),
    currency: char("currency", { length: 3 }),
    customerIdentityType: text("customer_identity_type"),
    customerIdentityNumber: text("customer_identity_number"),
    customerName: text("customer_name"),
    totals: jsonb("totals"),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    sunatTicket: text("sunat_ticket"),
    sunatResponseCode: text("sunat_response_code"),
    sunatResponseMessage: text("sunat_response_message"),
    ublProfile: text("ubl_profile"),
    rulesetVersion: text("ruleset_version"),
    relatedDocumentId: uuid("related_document_id"),
    idempotencyKey: text("idempotency_key"),
    error: jsonb("error"),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("documents_company_type_serie_number_uidx")
      .on(t.companyId, t.documentType, t.serie, t.number)
      .where(sql`${t.number} is not null`),
    uniqueIndex("documents_org_company_idempotency_uidx")
      .on(t.organizationId, t.companyId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("documents_org_company_created_idx").on(
      t.organizationId,
      t.companyId,
      t.createdAt,
    ),
    index("documents_org_company_status_idx").on(
      t.organizationId,
      t.companyId,
      t.status,
    ),
    index("documents_company_ticket_idx")
      .on(t.companyId, t.sunatTicket)
      .where(sql`${t.sunatTicket} is not null`),
    index("documents_company_serie_number_idx").on(t.companyId, t.serieNumber),
    check(
      "documents_status_check",
      sql`${t.status} in ('draft', 'validated', 'queued', 'sent', 'ticket_pending', 'accepted', 'accepted_with_observation', 'rejected', 'failed', 'cancelled')`,
    ),
    check(
      "documents_environment_check",
      sql`${t.environment} in ('sandbox', 'production')`,
    ),
  ],
);
