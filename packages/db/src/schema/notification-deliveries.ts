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
import { signupRequests } from "./signup-requests";

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: idColumn(),
    templateCode: text("template_code").notNull(),
    toEmail: text("to_email").notNull(),
    eventKey: text("event_key").notNull(),
    signupRequestId: uuid("signup_request_id").references(
      () => signupRequests.id,
      { onDelete: "set null" },
    ),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("notification_deliveries_event_key_uidx").on(t.eventKey),
    index("notification_deliveries_pending_idx")
      .on(t.status, t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
    index("notification_deliveries_signup_idx").on(t.signupRequestId),
    index("notification_deliveries_created_idx").on(t.createdAt),
    check(
      "notification_deliveries_status_check",
      sql`${t.status} in ('pending', 'success', 'failed')`,
    ),
  ],
);
