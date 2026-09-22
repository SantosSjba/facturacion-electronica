import { readAssetJson } from "../paths/package-root";

export interface ListUriMapping {
  ubl_path: string;
  attribute: string;
  value: string;
  json_path?: string | null;
}

interface ListUriFile {
  mappings: ListUriMapping[];
}

let cached: ListUriMapping[] | undefined;

const MVP_PATH_SUFFIXES = [
  "/cbc:ProfileID",
  "/cbc:InvoiceTypeCode",
  "/cbc:DocumentCurrencyCode",
  "/cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID",
  "/cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID",
  "/cac:InvoiceLine/cbc:InvoicedQuantity",
  "/cac:InvoiceLine/cac:PricingReference/cac:AlternativeConditionPrice/cbc:PriceTypeCode",
  "/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID",
  "/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID",
  "/cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID",
  "/cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TaxExemptionReasonCode",
  "/cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID",
] as const;

export function loadListUriMappings(): ListUriMapping[] {
  if (!cached) {
    const file = readAssetJson<ListUriFile>(
      "assets/ubl-attributes/invoice-listuri-schemes.json",
    );
    cached = file.mappings;
  }
  return cached;
}

function isLiteral(value: string): boolean {
  return !value.startsWith("<");
}

/**
 * Collect fixed listURI/scheme/list attrs for a UBL path suffix (MVP subset).
 * Dynamic placeholders (`<...>`) are skipped; callers pass overrides (schemeID, unitCode).
 */
export function attrsForPath(
  ublPathSuffix: string,
  dynamic: Record<string, string> = {},
): Record<string, string> {
  const attrs: Record<string, string> = { ...dynamic };
  for (const m of loadListUriMappings()) {
    if (!m.ubl_path.endsWith(ublPathSuffix)) continue;
    if (!MVP_PATH_SUFFIXES.some((s) => m.ubl_path.endsWith(s))) continue;
    if (!isLiteral(m.value)) continue;
    attrs[m.attribute] = m.value;
  }
  return attrs;
}

/** Convenience maps used by the XML builder. */
export const ListUri = {
  profileId: () => attrsForPath("/cbc:ProfileID"),
  invoiceTypeCode: () => attrsForPath("/cbc:InvoiceTypeCode"),
  currency: () => attrsForPath("/cbc:DocumentCurrencyCode"),
  companyId: (schemeId: string) =>
    attrsForPath(
      "/cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID",
      { schemeID: schemeId },
    ),
  invoicedQuantity: (unitCode: string) =>
    attrsForPath("/cac:InvoiceLine/cbc:InvoicedQuantity", { unitCode }),
  priceTypeCode: () =>
    attrsForPath(
      "/cac:InvoiceLine/cac:PricingReference/cac:AlternativeConditionPrice/cbc:PriceTypeCode",
    ),
  docTaxCategory: () =>
    attrsForPath("/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID"),
  docTaxScheme: () =>
    attrsForPath(
      "/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID",
    ),
  lineTaxCategory: () =>
    attrsForPath(
      "/cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID",
    ),
  taxExemptionReason: () =>
    attrsForPath(
      "/cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TaxExemptionReasonCode",
    ),
  lineTaxScheme: () =>
    attrsForPath(
      "/cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID",
    ),
};
