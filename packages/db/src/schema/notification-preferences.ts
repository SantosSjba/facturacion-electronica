import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn, updatedAt } from "./columns";
import { users } from "./users";

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventCode: text("event_code").notNull(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("notification_preferences_user_event_uidx").on(
      t.userId,
      t.eventCode,
    ),
    index("notification_preferences_user_idx").on(t.userId),
  ],
);
