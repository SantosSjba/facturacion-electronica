export const DOC_TYPE_LABELS: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de crédito",
  "08": "Nota de débito",
  "09": "GRE Remitente",
  "31": "GRE Transportista",
  RA: "Comunicación de baja",
  RC: "Resumen diario",
};

export const IDENTITY_TYPE_LABELS: Record<string, string> = {
  "0": "DOC.TRIB.NO.DOM",
  "1": "DNI",
  "4": "Carnet extranjería",
  "6": "RUC",
  "7": "Pasaporte",
};

/** Money fields shown in the Totales card (user-facing order). */
export const TOTAL_MONEY_KEYS = [
  "line_extension_amount",
  "total_taxed",
  "total_exonerated",
  "total_unaffected",
  "total_free",
  "total_export",
  "total_discount",
  "total_other_charges",
  "tax_amount",
  "total_igv",
  "total_other_taxes",
  "tax_inclusive_amount",
  "payable_amount",
  "total_payable",
] as const;

export const TOTAL_LABELS: Record<string, string> = {
  total_payable: "Importe total",
  payable_amount: "Importe total",
  total_taxed: "Op. gravada",
  total_igv: "IGV",
  tax_amount: "IGV",
  total_exonerated: "Op. exonerada",
  total_unaffected: "Op. inafecta",
  total_free: "Op. gratuita",
  total_discount: "Descuentos",
  total_other_charges: "Otros cargos",
  total_other_taxes: "Otros tributos",
  total_export: "Exportación",
  line_extension_amount: "Valor de venta",
  tax_inclusive_amount: "Total con IGV",
};

/** SUNAT Catálogo 05 — código de tributo (no es un monto). */
export const TAX_SCHEME_LABELS: Record<string, string> = {
  "1000": "IGV",
  "1016": "IVAP",
  "2000": "ISC",
  "9995": "Exportación",
  "9996": "Gratuito",
  "9997": "Exonerado",
  "9998": "Inafecto",
  "9999": "Otros tributos",
};

/** UBL tax category id (TaxCategory/ID). */
export const TAX_CATEGORY_LABELS: Record<string, string> = {
  S: "Gravado",
  E: "Exonerado",
  O: "Inafecto",
  Z: "Gratuito",
  G: "Exportación",
};

export function formatDocDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    // Date-only (YYYY-MM-DD) — avoid timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y!, m! - 1, d!).toLocaleDateString();
    }
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatMoney(
  value: unknown,
  currency: string | null | undefined,
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "—");
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: currency && currency.length === 3 ? currency : "PEN",
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}
