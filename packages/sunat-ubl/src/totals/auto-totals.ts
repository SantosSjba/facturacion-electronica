import type {
  InvoiceFixtureRequest,
  InvoiceLineCanonical,
  InvoiceCanonical,
  InvoiceTotals,
} from "../types/invoice-canonical";
import {
  finishCommercial,
  validateAdjustment,
  applyAdjustments,
  commercialFail,
} from "./commercial";
import { resolveTaxPair } from "./matrix-07-05";
import { ublValidationError } from "../errors";
import {
  decimalMultiply,
  decimalRound,
  decimalDivide,
  decimalAdd,
  subtractMoney,
  sumMoney,
} from "./decimal";

/** Round half-up to 2 decimal places (PEN). */
export function roundMoney(value: number): number {
  return decimalRound(value);
}

export function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2);
}

/**
 * Compute rounded line amounts, grouped taxes and collectible totals.
 * Free operations have a reference base/tax, but never increase the amount due.
 */
export function computeAutoTotals(
  request: InvoiceFixtureRequest,
  options: { quotaAdjustment?: boolean } = {},
): {
  lines: InvoiceLineCanonical[];
  totals: InvoiceTotals;
} {
  const fail = (path: string, issue: string): never => {
    throw ublValidationError("Invalid CPE amounts", { details: [{ path, issue }] });
  };
  const seen = new Set<number>();
  const lines: InvoiceLineCanonical[] = request.lines.map((line, index) => {
    const path = `lines.${index}`;
    if (seen.has(line.id)) fail(`${path}.id`, "Line IDs must be unique");
    seen.add(line.id);
    const pair = resolveTaxPair(line.tax_affectation, line.tax_scheme_id);
    const isFree = pair.tax_scheme_id === "9996";
    const taxable =
      ["1000", "1016"].includes(pair.tax_scheme_id) ||
      (isFree && /^1[1-7]$/.test(line.tax_affectation));
    const igvPercent = line.igv_percent ?? (line.tax_affectation === "17" ? 4 : taxable ? 18 : 0);
    if (line.tax_affectation === "17" && igvPercent !== 4)
      fail(`${path}.igv_percent`, "IVAP rate must be 4");
    if (!taxable && igvPercent !== 0)
      fail(`${path}.igv_percent`, "This affectation requires a zero rate");
    if (taxable && (igvPercent <= 0 || igvPercent > 100))
      fail(`${path}.igv_percent`, "Taxable operations require a positive rate up to 100");
    const adjustments = line.adjustments ?? [];
    adjustments.forEach((a, i) => {
      validateAdjustment(a, `${path}.adjustments.${i}`, "line");
      if (
        (a.tax_affectation && a.tax_affectation !== line.tax_affectation) ||
        (a.tax_scheme_id && a.tax_scheme_id !== pair.tax_scheme_id) ||
        (a.percent !== undefined && a.percent !== igvPercent) ||
        a.tier_range ||
        a.related_percent !== undefined
      )
        fail(
          `${path}.adjustments.${i}`,
          "Line adjustment fiscal metadata must match its primary tax",
        );
    });
    if (isFree && adjustments.length)
      fail(`${path}.adjustments`, "Free lines cannot receive discounts or charges");
    const base = applyAdjustments(
      decimalMultiply(line.unit_value, line.quantity),
      adjustments,
      true,
    );
    if (line.tax_affectation === "17" && line.isc) fail(`${path}.isc`, "IVAP cannot include ISC");
    const isc = line.isc;
    const iscBase =
      isc?.system === "03"
        ? decimalMultiply(decimalMultiply(isc.retail_unit_price, line.quantity, 1, 10), isc.factor)
        : base;
    const iscAmount = !isc
      ? 0
      : isc.system === "02"
        ? decimalMultiply(line.quantity, isc.per_unit_amount)
        : decimalMultiply(iscBase, isc.percent, 100);
    if (isc && iscBase <= 0) fail(`${path}.isc`, "ISC requires a positive reference base");
    const icbperAmount = line.icbper
      ? decimalMultiply(line.icbper.quantity, line.icbper.per_unit_amount)
      : 0;
    const igvBase = taxable ? sumMoney([base, iscAmount]) : base;
    if (isFree && base <= 0)
      fail(`${path}.unit_value`, "Free operations require a positive reference value");
    const lineExtension = isFree ? 0 : base;
    const igvAmount = decimalMultiply(igvBase, igvPercent, 100);
    const taxAmount = sumMoney([igvAmount, iscAmount, icbperAmount]);
    const expectedUnitPrice = isFree
      ? 0
      : adjustments.length || line.icbper
        ? decimalDivide(
            applyAdjustments(
              sumMoney([base, taxAmount]),
              adjustments.filter((a) => ["01", "48"].includes(a.code)),
            ),
            line.quantity,
          )
        : decimalMultiply(
            iscAmount
              ? decimalAdd(line.unit_value, decimalDivide(iscAmount, line.quantity))
              : line.unit_value,
            100 + igvPercent,
            100,
            10,
          );
    if (
      line.unit_price !== undefined &&
      roundMoney(line.unit_price) !== roundMoney(expectedUnitPrice)
    ) {
      fail(`${path}.unit_price`, `Expected ${expectedUnitPrice} from unit_value and tax rate`);
    }
    if (isFree && line.unit_price !== undefined && line.unit_price !== 0)
      fail(`${path}.unit_price`, "Free operations require a zero sale price");
    const unitPrice =
      line.unit_price === undefined ? expectedUnitPrice : decimalRound(line.unit_price, 10);
    const taxMeta =
      {
        "1000": { category: "S", type: "VAT" },
        "1016": { category: "S", type: "VAT" },
        "9997": { category: "E", type: "VAT" },
        "9998": { category: "O", type: "FRE" },
        "9995": { category: "G", type: "FRE" },
        "9996": { category: "Z", type: "FRE" },
      }[pair.tax_scheme_id] ?? fail(`${path}.tax_scheme_id`, "Unsupported tax scheme");

    return {
      ...line,
      tax_scheme_id: pair.tax_scheme_id,
      igv_percent: igvPercent,
      unit_price: unitPrice,
      line_extension_amount: lineExtension,
      tax_amount: taxAmount,
      taxable_amount: igvBase,
      tax_subtotals: [
        {
          taxable_amount: igvBase,
          tax_amount: igvAmount,
          tax_category_id: taxMeta.category,
          tax_scheme_id: pair.tax_scheme_id,
          tax_scheme_name: pair.tax_name,
          tax_type_code: taxMeta.type,
          percent: igvPercent,
        },
        ...(isc
          ? [
              {
                taxable_amount: iscBase,
                tax_amount: iscAmount,
                tax_category_id: "S",
                tax_scheme_id: "2000",
                tax_scheme_name: "ISC",
                tax_type_code: "EXC",
                percent: isc.system === "02" ? 0 : isc.percent,
                tier_range: isc.system,
                ...(isc.system === "02"
                  ? {
                      percent: decimalMultiply(decimalDivide(iscAmount, iscBase), 100, 1, 5),
                      base_unit_measure: line.quantity,
                      per_unit_amount: isc.per_unit_amount,
                    }
                  : {}),
              },
            ]
          : []),
        ...(line.icbper
          ? [
              {
                taxable_amount: 0,
                tax_amount: icbperAmount,
                tax_category_id: "S",
                tax_scheme_id: "7152",
                tax_scheme_name: "ICBPER",
                tax_type_code: "OTH",
                percent: 0,
                base_unit_measure: line.icbper.quantity,
                per_unit_amount: line.icbper.per_unit_amount,
              },
            ]
          : []),
      ],
      isc_amount: iscAmount,
      icbper_amount: icbperAmount,
      igv_amount: igvAmount,
      non_tax_adjustment: 0,
      tax_category_id: taxMeta.category,
      tax_scheme_name: pair.tax_name,
      tax_type_code: taxMeta.type,
      is_free: isFree,
    };
  });

  const grouped = new Map<string, InvoiceTotals["tax_subtotals"][number]>();
  for (const line of lines.flatMap((l) =>
    l.tax_subtotals
      .filter((g) => !(l.is_free && g.tax_scheme_id === "2000"))
      .map((g) =>
        g.tax_scheme_id === "1000"
          ? { ...g, taxable_amount: subtractMoney(g.taxable_amount, l.isc_amount) }
          : g,
      ),
  )) {
    const key = `${line.tax_category_id}/${line.tax_scheme_id}/${line.percent}/${line.tier_range ?? ""}`;
    const current = grouped.get(key);
    grouped.set(key, {
      taxable_amount: sumMoney([current?.taxable_amount ?? 0, line.taxable_amount]),
      tax_amount: sumMoney([current?.tax_amount ?? 0, line.tax_amount]),
      tax_category_id: line.tax_category_id,
      tax_scheme_id: line.tax_scheme_id,
      tax_scheme_name: line.tax_scheme_name,
      tax_type_code: line.tax_type_code,
      percent: line.percent,
      tier_range: line.tier_range,
    });
  }
  const subtotals = [...grouped.values()].sort(
    (a, b) => a.tax_scheme_id.localeCompare(b.tax_scheme_id) || a.percent - b.percent,
  );
  const lineExtensionAmount = sumMoney(lines.map((l) => l.line_extension_amount));
  const taxAmount = sumMoney(lines.map((l) => l.tax_amount));
  const freeTax = sumMoney(
    lines.filter((l) => l.is_free).map((l) => sumMoney([l.igv_amount, l.isc_amount])),
  );
  const payable = sumMoney([
    lineExtensionAmount,
    ...lines.map((l) => (l.is_free ? l.icbper_amount : l.tax_amount)),
  ]);
  const baseFor = (scheme: string) =>
    sumMoney(lines.filter((l) => l.tax_scheme_id === scheme).map((l) => l.taxable_amount));
  const primary = subtotals[0] ?? fail("lines", "At least one line is required");

  const totals: InvoiceTotals = {
    line_extension_amount: lineExtensionAmount,
    tax_amount: taxAmount,
    tax_inclusive_amount: payable,
    payable_amount: payable,
    tax_category_id: subtotals.length === 1 ? primary.tax_category_id : "MIXED",
    tax_scheme_id: subtotals.length === 1 ? primary.tax_scheme_id : "MIXED",
    tax_scheme_name: subtotals.length === 1 ? primary.tax_scheme_name : "MIXED",
    tax_subtotals: subtotals,
    taxed_amount: baseFor("1000"),
    exempt_amount: baseFor("9997"),
    unaffected_amount: baseFor("9998"),
    export_amount: baseFor("9995"),
    free_amount: baseFor("9996"),
    free_tax_amount: freeTax,
    igv_amount: 0,
    ivap_amount: 0,
    isc_amount: 0,
    icbper_amount: 0,
    prepaid_amount: 0,
    allowance_total_amount: 0,
    charge_total_amount: 0,
    advance_tax_amount: 0,
    computed_adjustments: [],
  };
  if (
    lines.some((l) => l.tax_affectation === "17") &&
    lines.some((l) => l.tax_affectation !== "17")
  )
    commercialFail("lines", "IVAP requires only affectation 17 lines");
  finishCommercial(request, lines, totals, options.quotaAdjustment);
  if (request.totals_mode === "strict" && !request.totals)
    fail("totals", "Required with totals_mode=strict");
  if (request.totals && request.totals_mode !== "strict")
    fail("totals_mode", "Use strict when supplying totals");
  if (request.totals) {
    for (const [key, value] of Object.entries(request.totals)) {
      const expected = totals[key as keyof InvoiceTotals];
      if (
        typeof expected !== "number" ||
        value !== roundMoney(value) ||
        roundMoney(value) !== expected
      ) {
        fail(
          `totals.${key}`,
          `Expected ${expected}; totals must match exactly at two decimal places`,
        );
      }
    }
  }
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
    issue_time: params.request.issue_time,
    due_date: params.request.due_date,
    purchase_order: params.request.purchase_order,
    legends: [
      ...(params.request.legends ?? []),
      ...(params.lines.every((line) => line.is_free) &&
      !params.request.legends?.some((l) => l.code === "1002")
        ? [{ code: "1002", text: "TRANSFERENCIA GRATUITA" }]
        : []),
      ...(params.request.detraction && !params.request.legends?.some((l) => l.code === "2006")
        ? [
            {
              code: "2006",
              text: "OPERACIÓN SUJETA AL SISTEMA DE PAGO DE OBLIGACIONES TRIBUTARIAS CON EL GOBIERNO CENTRAL",
            },
          ]
        : []),
      ...(params.lines.some((l) => l.tax_affectation === "17") &&
      !params.request.legends?.some((l) => l.code === "2007")
        ? [{ code: "2007", text: "OPERACIÓN SUJETA AL IVAP" }]
        : []),
    ],
    payment_terms: params.request.payment_terms,
    payment_means: params.request.payment_means,
    adjustments: params.request.adjustments,
    prepayments: params.request.prepayments,
    detraction: params.request.detraction,
    exchange_rate: params.request.exchange_rate,
    despatch_references: params.request.despatch_references,
    currency: params.request.currency,
    totals_mode: params.request.totals_mode ?? "auto",
    supplier: params.supplier,
    customer: params.request.customer,
    lines: params.lines,
    totals: params.totals,
  };
}
