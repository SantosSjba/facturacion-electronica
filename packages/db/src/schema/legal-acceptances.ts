import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { idColumn } from "./columns";
import { legalDocuments } from "./legal-documents";
import { organizations } from "./organizations";
import { users } from "./users";

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    legalDocumentId: uuid("legal_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "restrict" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    bodyHash: text("body_hash"),
  },
  (t) => [
    index("legal_acceptances_org_idx").on(t.organizationId),
    index("legal_acceptances_doc_idx").on(t.legalDocumentId),
  ],
);
