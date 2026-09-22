import type {
  InvoiceFixtureRequest,
  InvoiceLineCanonical,
  InvoiceCanonical,
  InvoiceTotals,
} from "../types/invoice-canonical";
import { resolveTaxPair } from "./matrix-07-05";
import { ublValidationError } from "../errors";

/** Round half-up to 2 decimal places (PEN). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2);
}

/**
 * Compute line + document totals for `totals_mode: auto`.
 * Spike MVP: single gravado line (10 / 1000 / 18%).
 */
export function computeAutoTotals(
  request: InvoiceFixtureRequest,
): { lines: InvoiceLineCanonical[]; totals: InvoiceTotals } {
  if (request.totals_mode === "strict") {
    throw ublValidationError("totals_mode=strict is not implemented in Spike B");
  }

  const lines: InvoiceLineCanonical[] = request.lines.map((line) => {
    const pair = resolveTaxPair(line.tax_affectation, line.tax_scheme_id);
    const igvPercent =
      line.igv_percent ??
      pair.igv_percent_typical ??
      (pair.tax_scheme_id === "1000" ? 18 : 0);

    const lineExtension = roundMoney(line.unit_value * line.quantity);
    const taxAmount = roundMoney(lineExtension * (igvPercent / 100));
    const unitPrice =
      line.unit_price !== undefined
        ? roundMoney(line.unit_price)
        : roundMoney(line.unit_value * (1 + igvPercent / 100));

    return {
      ...line,
      tax_scheme_id: pair.tax_scheme_id,
      igv_percent: igvPercent,
      unit_price: unitPrice,
      line_extension_amount: lineExtension,
      tax_amount: taxAmount,
    };
  });

  const lineExtensionAmount = roundMoney(
    lines.reduce((sum, l) => sum + l.line_extension_amount, 0),
  );
  const taxAmount = roundMoney(lines.reduce((sum, l) => sum + l.tax_amount, 0));
  const payable = roundMoney(lineExtensionAmount + taxAmount);
  const primaryScheme = lines[0]?.tax_scheme_id ?? "1000";
  const pair = resolveTaxPair(lines[0]?.tax_affectation ?? "10", primaryScheme);

  const totals: InvoiceTotals = {
    line_extension_amount: lineExtensionAmount,
    tax_amount: taxAmount,
    tax_inclusive_amount: payable,
    payable_amount: payable,
    tax_category_id: "S",
    tax_scheme_id: primaryScheme,
    tax_scheme_name: pair.tax_name || "IGV",
  };

  return { lines, totals };
}

export function padCorrelative(number: number): string {
  return String(number).padStart(8, "0");
}

export function documentId(serie: string, number: number): string {
  return `${serie.toUpperCase()}-${padCorrelative(number)}`;
}

export function fileStem(
  supplierRuc: string,
  documentType: string,
  serie: string,
  number: number,
): string {
  return `${supplierRuc}-${documentType}-${serie.toUpperCase()}-${number}`;
}

/** Build full canonical from totals output + parties. */
export function toCanonical(params: {
  request: InvoiceFixtureRequest;
  supplier: InvoiceCanonical["supplier"];
  number: number;
  lines: InvoiceLineCanonical[];
  totals: InvoiceTotals;
}): InvoiceCanonical {
  const documentType =
    params.request.document_type ??
    (params.request.serie.toUpperCase().startsWith("B") ? "03" : "01");
  return {
    document_type: documentType,
    serie: params.request.serie.toUpperCase(),
    number: params.number,
    operation_type: params.request.operation_type,
    issue_date: params.request.issue_date,
    currency: params.request.currency,
    totals_mode: params.request.totals_mode ?? "auto",
    supplier: params.supplier,
    customer: params.request.customer,
    lines: params.lines,
    totals: params.totals,
  };
}
