import {
  cpeAddressSchema,
  computeAutoTotals,
  validateNoteReason,
  type PartyCanonical,
} from "@factosys/sunat-ubl";
import { AppError } from "@factosys/shared";
import type { InvoiceCreate } from "../../interfaces/http/dto/invoice-create.schema";
import type { CreditNoteCreate } from "../../interfaces/http/dto/credit-note-create.schema";
import type { ReceiptCreate } from "../../interfaces/http/dto/receipt-create.schema";

/** Fail before allocating a correlative or signing; unsupported fields never disappear. */
export function validateCpeInput(
  body: InvoiceCreate | CreditNoteCreate | ReceiptCreate,
  documentType?: "07" | "08",
): void {
  const reject = (path: string, issue: string): never => {
    throw AppError.validation("Unsupported CPE input", [{ path, issue }], { httpStatus: 422 });
  };
  if (body.number !== undefined)
    reject("number", "Correlatives are allocated by the server; omit number");
  if (
    "operation_type" in body &&
    !["0101", "0200", "1001", "1002", "1003", "1004"].includes(body.operation_type)
  )
    reject("operation_type", "Unsupported operation type");
  if (
    body.customer.non_resident &&
    (!body.customer.address?.country_code || body.customer.address.country_code === "PE")
  )
    reject("customer.address.country_code", "Nonresident customer requires foreign country code");
  if (
    "operation_type" in body &&
    body.operation_type === "0200" &&
    body.lines.some((l) => l.tax_affectation !== "40")
  )
    reject("lines.tax_affectation", "Export operation requires export lines");
  if (
    "operation_type" in body &&
    body.operation_type !== "0200" &&
    body.lines.some((l) => l.tax_affectation === "40")
  )
    reject("operation_type", "Export lines require operation 0200");
  if (
    documentType === "07" &&
    "note_type" in body &&
    body.note_type === "13" &&
    (body.payment_terms?.condition !== "credit" ||
      body.lines.some((l) => l.unit_value !== 0 || l.isc || l.icbper || l.adjustments?.length) ||
      body.prepayments?.length ||
      body.adjustments?.length)
  )
    reject(
      "note_type",
      "Quota adjustment 13 requires credit terms and zero-value lines without fiscal adjustments",
    );
  if ("note_type" in body && (body.prepayments?.length || body.detraction))
    reject("prepayments", "Prepayment regularization and detraction belong to invoices/receipts");
  if (body.due_date && body.due_date < body.issue_date)
    reject("due_date", "Must not precede issue_date");
  if ("note_type" in body && body.due_date && !(documentType === "07" && body.note_type === "13"))
    reject("due_date", "Due date on notes is not currently supported");
  const summaryRequested =
    body.serie.toUpperCase().startsWith("B") &&
    "include_in_daily_summary" in body &&
    body.include_in_daily_summary === true &&
    !("send_individually" in body && body.send_individually === true);
  if (
    summaryRequested &&
    (body.currency !== "PEN" ||
      body.lines.some((line) => line.tax_affectation === "40") ||
      [...(body.adjustments ?? []), ...body.lines.flatMap((l) => l.adjustments ?? [])].some((a) =>
        ["01", "03"].includes(a.code),
      ) ||
      (documentType === "07" && "note_type" in body && body.note_type === "13"))
  ) {
    reject(
      "include_in_daily_summary",
      "Foreign currency, export, non-tax discounts and quota corrections require individual emission",
    );
  }
  try {
    if (documentType && "note_type" in body) validateNoteReason(body, documentType);
    computeAutoTotals(
      {
        ...body,
        document_type: undefined,
        operation_type: "operation_type" in body ? body.operation_type : "0101",
      },
      { quotaAdjustment: documentType === "07" && "note_type" in body && body.note_type === "13" },
    );
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
