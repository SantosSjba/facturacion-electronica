import { pgTable, text } from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";

export const roles = pgTable("roles", {
  id: idColumn(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});
