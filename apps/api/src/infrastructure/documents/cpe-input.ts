import { cpeAddressSchema, computeAutoTotals, type PartyCanonical } from "@factosys/sunat-ubl";
import { AppError } from "@factosys/shared";
import type { InvoiceCreate } from "../../interfaces/http/dto/invoice-create.schema";
import type { CreditNoteCreate } from "../../interfaces/http/dto/credit-note-create.schema";
import type { ReceiptCreate } from "../../interfaces/http/dto/receipt-create.schema";

/** Fail before allocating a correlative or signing; unsupported fields never disappear. */
export function validateCpeInput(body: InvoiceCreate | CreditNoteCreate | ReceiptCreate): void {
  const reject = (path: string, issue: string): never => {
    throw AppError.validation("Unsupported CPE input", [{ path, issue }], { httpStatus: 422 });
  };
  if (body.number !== undefined)
    reject("number", "Correlatives are allocated by the server; omit number");
  if ("detraction" in body && body.detraction !== undefined)
    reject("detraction", "Detraction is pending phase 1");
  if ("payment_means" in body && body.payment_means !== undefined)
    reject("payment_means", "Payment means and credit terms are pending phase 1");
  if ("operation_type" in body && !["0101", "0200"].includes(body.operation_type)) {
    reject("operation_type", "Only domestic sale 0101 and export 0200 are currently supported");
  }
  if (body.due_date && body.due_date < body.issue_date)
    reject("due_date", "Must not precede issue_date");
  if ("note_type" in body && body.note_type === "13")
    reject("note_type", "Credit installment adjustments are pending phase 1");
  if ("note_type" in body && body.due_date)
    reject("due_date", "Due date on notes is not currently supported");
  const summaryRequested =
    body.serie.toUpperCase().startsWith("B") &&
    "include_in_daily_summary" in body &&
    body.include_in_daily_summary === true &&
    !("send_individually" in body && body.send_individually === true);
  if (
    summaryRequested &&
    (body.currency !== "PEN" || body.lines.some((line) => line.tax_affectation === "40"))
  ) {
    reject(
      "include_in_daily_summary",
      "RC in foreign currency or export is not supported; send the document individually",
    );
  }
  try {
    computeAutoTotals({
      ...body,
      document_type: undefined,
      operation_type: "operation_type" in body ? body.operation_type : "0101",
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw AppError.validation(error.message, error.details, { httpStatus: 422 });
    }
    throw error;
  }
}

export function supplierParty(company: {
  ruc: string;
  legalName: string;
  address?: unknown;
}): PartyCanonical {
  const address = company.address == null ? undefined : cpeAddressSchema.safeParse(company.address);
  if (address && !address.success) {
    throw AppError.validation(
      "Invalid company address",
      address.error.issues.map((issue) => ({
        path: `supplier.address.${issue.path.join(".")}`,
        issue: issue.message,
      })),
      { httpStatus: 422 },
    );
  }
  return {
    identity_type: "6",
    identity_number: company.ruc,
    name: company.legalName,
    address: address?.data,
  };
}
