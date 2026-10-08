import type { create } from "xmlbuilder2";
import { ListUri } from "../attributes/listuri-injector";
import { formatMoney } from "../totals/auto-totals";
import type {
  InvoiceCanonical,
  InvoiceLineCanonical,
  InvoiceTotals,
  PartyCanonical,
} from "../types/invoice-canonical";

type Node = ReturnType<ReturnType<typeof create>["ele"]>;

export function formatUnit(value: number, minimumPlaces = 2): string {
  const [mantissa = "0", exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole = "0", fraction = ""] = mantissa.split(".");
  const digits = whole + fraction;
  const position = whole.length + Number(exponent);
  const text =
    position <= 0
      ? `0.${"0".repeat(-position)}${digits}`
      : position >= digits.length
        ? digits + "0".repeat(position - digits.length)
        : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return text.includes(".")
    ? text.padEnd(text.indexOf(".") + 1 + minimumPlaces, "0")
    : minimumPlaces
      ? `${text}.${"0".repeat(minimumPlaces)}`
      : text;
}

export function appendCpeParty(
  root: Node,
  tag: string,
  party: PartyCanonical,
  supplier = false,
): void {
  const node = root.ele(tag).ele("cac:Party");
  node
    .ele("cac:PartyIdentification")
    .ele("cbc:ID", { schemeID: party.identity_type })
    .txt(party.identity_number);
  const tax = node.ele("cac:PartyTaxScheme");
  tax.ele("cbc:CompanyID", ListUri.companyId(party.identity_type)).txt(party.identity_number);
  tax.ele("cac:TaxScheme").ele("cbc:ID").txt("1000");
  const legal = node.ele("cac:PartyLegalEntity");
  legal.ele("cbc:RegistrationName").txt(party.name);
  const address = party.address;
  if (supplier || address) {
    const reg = legal.ele("cac:RegistrationAddress");
    if (address?.ubigeo) reg.ele("cbc:ID").txt(address.ubigeo);
    if (supplier || address?.establishment_code)
      reg
        .ele("cbc:AddressTypeCode", {
          listAgencyName: "PE:SUNAT",
          listName: "SUNAT:Identificador de establecimiento",
          listURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo54",
        })
        .txt(address?.establishment_code ?? "0000");
    if (address?.urbanization) reg.ele("cbc:CitySubdivisionName").txt(address.urbanization);
    if (address?.province) reg.ele("cbc:CityName").txt(address.province);
    if (address?.department) reg.ele("cbc:CountrySubentity").txt(address.department);
    if (address?.district) reg.ele("cbc:District").txt(address.district);
    if (address?.line) reg.ele("cac:AddressLine").ele("cbc:Line").txt(address.line);
    if (address)
      reg
        .ele("cac:Country")
        .ele("cbc:IdentificationCode")
        .txt(address.country_code ?? "PE");
  }
  if (party.email) node.ele("cac:Contact").ele("cbc:ElectronicMail").txt(party.email);
}

export function appendDocumentTaxes(root: Node, totals: InvoiceTotals, cur: string): void {
  const tax = root.ele("cac:TaxTotal");
  tax.ele("cbc:TaxAmount", { currencyID: cur }).txt(formatMoney(totals.tax_amount));
  for (const group of totals.tax_subtotals) {
    const sub = tax.ele("cac:TaxSubtotal");
    sub.ele("cbc:TaxableAmount", { currencyID: cur }).txt(formatMoney(group.taxable_amount));
    sub.ele("cbc:TaxAmount", { currencyID: cur }).txt(formatMoney(group.tax_amount));
    const cat = sub.ele("cac:TaxCategory");
    cat.ele("cbc:ID", ListUri.docTaxCategory()).txt(group.tax_category_id);
    // Explicit rate when multiple groups exist; preserves the single-rate golden contract.
    if (totals.tax_subtotals.length > 1) cat.ele("cbc:Percent").txt(String(group.percent));
    const scheme = cat.ele("cac:TaxScheme");
    scheme.ele("cbc:ID", ListUri.docTaxScheme()).txt(group.tax_scheme_id);
    scheme.ele("cbc:Name").txt(group.tax_scheme_name);
    scheme.ele("cbc:TaxTypeCode").txt(group.tax_type_code);
  }
}

export function appendCpeLineTaxes(node: Node, line: InvoiceLineCanonical, cur: string): void {
  const tax = node.ele("cac:TaxTotal");
  tax.ele("cbc:TaxAmount", { currencyID: cur }).txt(formatMoney(line.tax_amount));
  const sub = tax.ele("cac:TaxSubtotal");
  sub.ele("cbc:TaxableAmount", { currencyID: cur }).txt(formatMoney(line.taxable_amount));
  sub.ele("cbc:TaxAmount", { currencyID: cur }).txt(formatMoney(line.tax_amount));
  const cat = sub.ele("cac:TaxCategory");
  cat.ele("cbc:ID", ListUri.lineTaxCategory()).txt(line.tax_category_id);
  cat.ele("cbc:Percent").txt(String(line.igv_percent));
  cat.ele("cbc:TaxExemptionReasonCode", ListUri.taxExemptionReason()).txt(line.tax_affectation);
  const scheme = cat.ele("cac:TaxScheme");
  scheme.ele("cbc:ID", ListUri.lineTaxScheme()).txt(line.tax_scheme_id);
  scheme.ele("cbc:Name").txt(line.tax_scheme_name);
  scheme.ele("cbc:TaxTypeCode").txt(line.tax_type_code);
}

export function appendCpeItem(node: Node, line: InvoiceLineCanonical): void {
  const item = node.ele("cac:Item");
  item.ele("cbc:Description").txt(line.description);
  if (line.product_code)
    item.ele("cac:SellersItemIdentification").ele("cbc:ID").txt(line.product_code);
  if (line.sunat_product_code)
    item
      .ele("cac:CommodityClassification")
      .ele("cbc:ItemClassificationCode", {
        listID: "UNSPSC",
        listAgencyName: "GS1 US",
        listName: "Item Classification",
      })
      .txt(line.sunat_product_code);
}

export function appendLegends(
  root: Node,
  canonical: Pick<InvoiceCanonical, "lines" | "legends">,
): void {
  const legends = [...(canonical.legends ?? [])];
  if (
    canonical.lines.every((line) => line.is_free) &&
    !legends.some((legend) => legend.code === "1002")
  ) {
    legends.push({ code: "1002", text: "TRANSFERENCIA GRATUITA" });
  }
  for (const legend of legends)
    root.ele("cbc:Note", { languageLocaleID: legend.code }).txt(legend.text);
}
