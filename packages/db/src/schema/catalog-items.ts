import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, idColumn } from "./columns";
import { catalogVersions } from "./catalog-versions";

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: idColumn(),
    catalogVersionId: uuid("catalog_version_id")
      .notNull()
      .references(() => catalogVersions.id, { onDelete: "cascade" }),
    catalogCode: text("catalog_code").notNull(),
    itemCode: text("item_code").notNull(),
    description: text("description"),
    attrs: jsonb("attrs")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("catalog_items_version_code_item_uidx").on(
      t.catalogVersionId,
      t.catalogCode,
      t.itemCode,
    ),
    index("catalog_items_version_code_idx").on(t.catalogVersionId, t.catalogCode),
  ],
);
