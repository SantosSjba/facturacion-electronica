import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { idColumn, createdAt, updatedAt } from "./columns";
import { organizations } from "./organizations";
import { documents } from "./documents";

export const documentDeliveries = pgTable(
  "document_deliveries",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    requestKey: text("request_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("waiting"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("document_delivery_request_uidx").on(
      t.organizationId,
      t.documentId,
      t.requestKey,
      t.recipient,
    ),
    index("document_delivery_status_idx").on(t.status, t.updatedAt),
  ],
);

export const documentShares = pgTable(
  "document_shares",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    allowedArtifacts: jsonb("allowed_artifacts").$type<string[]>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("document_shares_hash_uidx").on(t.tokenHash),
    index("document_shares_doc_idx").on(t.organizationId, t.documentId),
  ],
);
