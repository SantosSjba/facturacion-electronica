import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: idColumn(),
    code: text("code").notNull(),
    channel: text("channel").notNull(),
    subject: text("subject").notNull(),
    bodyMd: text("body_md").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notification_templates_code_uidx").on(t.code),
    check(
      "notification_templates_channel_check",
      sql`${t.channel} in ('email', 'in_app')`,
    ),
  ],
);
