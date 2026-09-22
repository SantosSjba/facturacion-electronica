import { create } from "xmlbuilder2";

import { ListUri } from "../attributes/listuri-injector";
import type {
  BuildInvoiceXmlPort,
  BuildInvoiceXmlResult,
} from "../ports/build-invoice-xml.port";
import {
  documentId,
  fileStem,
  formatMoney,
} from "../totals/auto-totals";
import type { InvoiceCanonical } from "../types/invoice-canonical";
import { assertInvoiceCanonical } from "../types/invoice-canonical";

const NS = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
} as const;

/**
 * Deterministic unsigned Invoice UBL 2.1 builder (Spike B).
 */
export class XmlInvoiceBuilder implements BuildInvoiceXmlPort {
  build(input: InvoiceCanonical): BuildInvoiceXmlResult {
    const canonical = assertInvoiceCanonical(input);
    const id = documentId(canonical.serie, canonical.number);
    const stem = fileStem(
      canonical.supplier.identity_number,
      canonical.serie,
      canonical.number,
    );
    const cur = canonical.currency;
    const line = canonical.lines[0];
    if (!line) {
      throw new Error("InvoiceCanonical requires at least one line");
    }

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele("Invoice", {
      xmlns: NS.invoice,
      "xmlns:cac": NS.cac,
      "xmlns:cbc": NS.cbc,
      "xmlns:ds": NS.ds,
      "xmlns:ext": NS.ext,
    });

    root
      .ele("ext:UBLExtensions")
      .ele("ext:UBLExtension")
      .ele("ext:ExtensionContent")
      .up()
      .up()
      .up();

    root.ele("cbc:UBLVersionID").txt("2.1").up();
    root.ele("cbc:CustomizationID").txt("2.0").up();
    root.ele("cbc:ProfileID", ListUri.profileId()).txt(canonical.operation_type).up();
    root.ele("cbc:ID").txt(id).up();
    root.ele("cbc:IssueDate").txt(canonical.issue_date).up();
    root
      .ele("cbc:InvoiceTypeCode", ListUri.invoiceTypeCode())
      .txt(canonical.document_type)
      .up();
    root.ele("cbc:DocumentCurrencyCode", ListUri.currency()).txt(cur).up();

    appendParty(
      root,
      "cac:AccountingSupplierParty",
      canonical.supplier,
    );
    appendParty(
      root,
      "cac:AccountingCustomerParty",
      canonical.customer,
    );

    // Document TaxTotal
    const taxTotal = root.ele("cac:TaxTotal");
    taxTotal
      .ele("cbc:TaxAmount", { currencyID: cur })
      .txt(formatMoney(canonical.totals.tax_amount))
      .up();
    const sub = taxTotal.ele("cac:TaxSubtotal");
    sub
      .ele("cbc:TaxableAmount", { currencyID: cur })
      .txt(formatMoney(canonical.totals.line_extension_amount))
      .up();
    sub
      .ele("cbc:TaxAmount", { currencyID: cur })
      .txt(formatMoney(canonical.totals.tax_amount))
      .up();
    const cat = sub.ele("cac:TaxCategory");
    cat
      .ele("cbc:ID", ListUri.docTaxCategory())
      .txt(canonical.totals.tax_category_id)
      .up();
    const scheme = cat.ele("cac:TaxScheme");
    scheme
      .ele("cbc:ID", ListUri.docTaxScheme())
      .txt(canonical.totals.tax_scheme_id)
      .up();
    scheme.ele("cbc:Name").txt(canonical.totals.tax_scheme_name).up();
    scheme.ele("cbc:TaxTypeCode").txt("VAT").up();

    const monetary = root.ele("cac:LegalMonetaryTotal");
    monetary
      .ele("cbc:LineExtensionAmount", { currencyID: cur })
      .txt(formatMoney(canonical.totals.line_extension_amount))
      .up();
    monetary
      .ele("cbc:TaxInclusiveAmount", { currencyID: cur })
      .txt(formatMoney(canonical.totals.tax_inclusive_amount))
      .up();
    monetary
      .ele("cbc:PayableAmount", { currencyID: cur })
      .txt(formatMoney(canonical.totals.payable_amount))
      .up();

    // Single InvoiceLine
    const invLine = root.ele("cac:InvoiceLine");
    invLine.ele("cbc:ID").txt(String(line.id)).up();
    invLine
      .ele("cbc:InvoicedQuantity", ListUri.invoicedQuantity(line.unit_code))
      .txt(String(line.quantity))
      .up();
    invLine
      .ele("cbc:LineExtensionAmount", { currencyID: cur })
      .txt(formatMoney(line.line_extension_amount))
      .up();

    const pricing = invLine.ele("cac:PricingReference").ele("cac:AlternativeConditionPrice");
    pricing
      .ele("cbc:PriceAmount", { currencyID: cur })
      .txt(formatMoney(line.unit_price))
      .up();
    pricing.ele("cbc:PriceTypeCode", ListUri.priceTypeCode()).txt("01").up();

    const lineTax = invLine.ele("cac:TaxTotal");
    lineTax
      .ele("cbc:TaxAmount", { currencyID: cur })
      .txt(formatMoney(line.tax_amount))
      .up();
    const lineSub = lineTax.ele("cac:TaxSubtotal");
    lineSub
      .ele("cbc:TaxableAmount", { currencyID: cur })
      .txt(formatMoney(line.line_extension_amount))
      .up();
    lineSub
      .ele("cbc:TaxAmount", { currencyID: cur })
      .txt(formatMoney(line.tax_amount))
      .up();
    const lineCat = lineSub.ele("cac:TaxCategory");
    lineCat.ele("cbc:ID", ListUri.lineTaxCategory()).txt("S").up();
    lineCat.ele("cbc:Percent").txt(String(line.igv_percent)).up();
    lineCat
      .ele("cbc:TaxExemptionReasonCode", ListUri.taxExemptionReason())
      .txt(line.tax_affectation)
      .up();
    const lineScheme = lineCat.ele("cac:TaxScheme");
    lineScheme
      .ele("cbc:ID", ListUri.lineTaxScheme())
      .txt(line.tax_scheme_id)
      .up();
    lineScheme.ele("cbc:Name").txt(canonical.totals.tax_scheme_name).up();
    lineScheme.ele("cbc:TaxTypeCode").txt("VAT").up();

    invLine.ele("cac:Item").ele("cbc:Description").txt(line.description).up().up();
    invLine
      .ele("cac:Price")
      .ele("cbc:PriceAmount", { currencyID: cur })
      .txt(formatMoney(line.unit_value))
      .up()
      .up();

    const xml = root.end({ prettyPrint: true, indent: "  ", newline: "\n" });
    return { xml, fileStem: stem };
  }
}

function appendParty(
  root: ReturnType<ReturnType<typeof create>["ele"]>,
  tag: "cac:AccountingSupplierParty" | "cac:AccountingCustomerParty",
  party: InvoiceCanonical["supplier"],
): void {
  const node = root.ele(tag).ele("cac:Party");
  node
    .ele("cac:PartyIdentification")
    .ele("cbc:ID", { schemeID: party.identity_type })
    .txt(party.identity_number)
    .up()
    .up();
  node
    .ele("cac:PartyLegalEntity")
    .ele("cbc:RegistrationName")
    .txt(party.name)
    .up()
    .up();
  const taxScheme = node.ele("cac:PartyTaxScheme");
  taxScheme
    .ele("cbc:CompanyID", ListUri.companyId(party.identity_type))
    .txt(party.identity_number)
    .up();
  taxScheme
    .ele("cac:TaxScheme")
    .ele("cbc:ID")
    .txt("1000")
    .up()
    .up();
}
