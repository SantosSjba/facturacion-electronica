import { index, primaryKey, pgTable, uuid } from "drizzle-orm/pg-core";

import { roles } from "./roles";
import { users } from "./users";

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_user_idx").on(t.userId),
  ],
);
