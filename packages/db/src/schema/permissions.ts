import { pgTable, text } from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";

export const permissions = pgTable("permissions", {
  id: idColumn(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: createdAt(),
});
