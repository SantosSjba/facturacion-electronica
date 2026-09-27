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

export const TOTAL_LABELS: Record<string, string> = {
  total_payable: "Importe total",
  payable_amount: "Importe total",
  total_taxed: "Op. gravada",
  total_igv: "IGV",
  total_exonerated: "Op. exonerada",
  total_unaffected: "Op. inafecta",
  total_free: "Op. gratuita",
  total_discount: "Descuentos",
  total_other_charges: "Otros cargos",
  total_other_taxes: "Otros tributos",
  total_export: "Exportación",
  line_extension_amount: "Valor venta",
  tax_inclusive_amount: "Total con IGV",
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
