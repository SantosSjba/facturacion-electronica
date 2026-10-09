import fs from "node:fs";
import path from "node:path";
import { invoiceCreateSchema } from "../apps/api/src/interfaces/http/dto/invoice-create.schema";
import { receiptCreateSchema } from "../apps/api/src/interfaces/http/dto/receipt-create.schema";
import { creditNoteCreateSchema } from "../apps/api/src/interfaces/http/dto/credit-note-create.schema";
import { debitNoteCreateSchema } from "../apps/api/src/interfaces/http/dto/debit-note-create.schema";
import { despatchAdviceCreateSchema } from "../apps/api/src/interfaces/http/dto/despatch-advice-create.schema";
import { dailySummaryCreateSchema } from "../apps/api/src/interfaces/http/dto/daily-summary-create.schema";
import { voidedDocumentCreateSchema } from "../apps/api/src/interfaces/http/dto/voided-document-create.schema";
const dir = path.resolve("docs/integracion/cases");
for (const name of fs.readdirSync(dir)) {
  const body = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  const schema = name.startsWith("gre-")
    ? despatchAdviceCreateSchema
    : name === "boleta.json"
      ? receiptCreateSchema
      : name === "nota-debito.json"
        ? debitNoteCreateSchema
        : name.startsWith("nota-")
          ? creditNoteCreateSchema
          : name === "baja-factura.json"
            ? voidedDocumentCreateSchema
            : name === "resumen-diario.json"
              ? dailySummaryCreateSchema
              : invoiceCreateSchema;
  const result = schema.safeParse(body);
  if (!result.success) throw new Error(name + ": " + JSON.stringify(result.error.issues));
}
console.log("All 26 example payloads pass strict request schemas (no network or issuance).");
