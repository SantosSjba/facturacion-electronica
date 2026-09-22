import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { documents } from "./documents";
import { organizations } from "./organizations";
import { webhookEndpoints } from "./webhook-endpoints";

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    httpStatus: integer("http_status"),
    responseExcerpt: text("response_excerpt"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("webhook_deliveries_endpoint_idempotency_uidx").on(
      t.endpointId,
      t.idempotencyKey,
    ),
    index("webhook_deliveries_pending_idx")
      .on(t.status, t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
    index("webhook_deliveries_document_idx").on(t.documentId),
    index("webhook_deliveries_endpoint_created_idx").on(
      t.endpointId,
      t.createdAt,
    ),
    check(
      "webhook_deliveries_status_check",
      sql`${t.status} in ('pending', 'success', 'failed')`,
    ),
  ],
);
