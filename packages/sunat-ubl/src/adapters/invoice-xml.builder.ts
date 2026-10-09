import {
  appendCommercialReferences,
  appendCommercialPayments,
  appendMonetary,
  appendAdjustment,
  appendCommercialDelivery,
} from "./commercial-xml";
import { create } from "xmlbuilder2";
import { appendExtendedPartiesAndDelivery } from "./extended-commercial-xml";
import {
  appendCpeParty,
  appendDocumentTaxes,
  appendCpeLineTaxes,
  appendCpeItem,
  appendLegends,
  formatUnit,
} from "./cpe-xml";

import { ListUri } from "../attributes/listuri-injector";
import type { BuildInvoiceXmlPort, BuildInvoiceXmlResult } from "../ports/build-invoice-xml.port";
import { documentId, fileStem, formatMoney } from "../totals/auto-totals";
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
      canonical.document_type,
      canonical.serie,
      canonical.number,
    );
    const cur = canonical.currency;
    const root = create({ version: "1.0", encoding: "UTF-8" }).ele("Invoice", {
      xmlns: NS.invoice,
      "xmlns:cac": NS.cac,
      "xmlns:cbc": NS.cbc,
      "xmlns:ds": NS.ds,
      "xmlns:ext": NS.ext,
    });

    // Unsigned docs omit empty UBLExtensions: ExtensionContent requires ##other (XSD).
    // XmlCryptoSignAdapter inserts UBLExtensions + ds:Signature at sign time.

    root.ele("cbc:UBLVersionID").txt("2.1").up();
    root.ele("cbc:CustomizationID").txt("2.0").up();
    root.ele("cbc:ProfileID", ListUri.profileId()).txt(canonical.operation_type).up();
    root.ele("cbc:ID").txt(id).up();
    root.ele("cbc:IssueDate").txt(canonical.issue_date).up();
    if (canonical.issue_time) root.ele("cbc:IssueTime").txt(canonical.issue_time);
    if (canonical.due_date) root.ele("cbc:DueDate").txt(canonical.due_date);
    root
      .ele("cbc:InvoiceTypeCode", {
        ...ListUri.invoiceTypeCode(),
        listID: canonical.operation_type,
      })
      .txt(canonical.document_type)
      .up();
    appendLegends(root, canonical);
    if (canonical.observations) root.ele("cbc:Note").txt(canonical.observations).up();
    root.ele("cbc:DocumentCurrencyCode", ListUri.currency()).txt(cur).up();

    if (canonical.purchase_order)
      root.ele("cac:OrderReference").ele("cbc:ID").txt(canonical.purchase_order);
    appendCommercialReferences(root, canonical);
    appendCpeParty(root, "cac:AccountingSupplierParty", canonical.supplier, true);
    appendCpeParty(root, "cac:AccountingCustomerParty", canonical.customer);
    appendExtendedPartiesAndDelivery(root, canonical);

    appendCommercialPayments(root, canonical);
    appendDocumentTaxes(root, canonical.totals, cur);
    appendMonetary(root, "cac:LegalMonetaryTotal", canonical.totals, cur);

    for (const line of canonical.lines) {
      const invLine = root.ele("cac:InvoiceLine");
      invLine.ele("cbc:ID").txt(String(line.id)).up();
      invLine
        .ele("cbc:InvoicedQuantity", ListUri.invoicedQuantity(line.unit_code))
        .txt(formatUnit(line.quantity, 0))
        .up();
      invLine
        .ele("cbc:LineExtensionAmount", { currencyID: cur })
        .txt(formatMoney(line.line_extension_amount))
        .up();

      const pricing = invLine.ele("cac:PricingReference").ele("cac:AlternativeConditionPrice");
      pricing
        .ele("cbc:PriceAmount", { currencyID: cur })
        .txt(formatUnit(line.is_free ? line.unit_value : line.unit_price))
        .up();
      pricing
        .ele("cbc:PriceTypeCode", ListUri.priceTypeCode())
        .txt(line.is_free ? "02" : "01")
        .up();

      appendCommercialDelivery(invLine, line);
      for (const a of line.adjustments ?? []) appendAdjustment(invLine, a, cur);
      appendCpeLineTaxes(invLine, line, cur);
      appendCpeItem(invLine, line);
      invLine
        .ele("cac:Price")
        .ele("cbc:PriceAmount", { currencyID: cur })
        .txt(formatUnit(line.is_free ? 0 : line.unit_value))
        .up()
        .up();
    }

    const xml = root.end({ prettyPrint: true, indent: "  ", newline: "\n" });
    return { xml, fileStem: stem };
  }
}
