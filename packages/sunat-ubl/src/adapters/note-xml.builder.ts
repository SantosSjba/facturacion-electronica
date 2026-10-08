import { create } from "xmlbuilder2";
import {
  appendCpeParty,
  appendDocumentTaxes,
  appendCpeLineTaxes,
  appendCpeItem,
  appendLegends,
  formatUnit,
} from "./cpe-xml";

import { ListUri } from "../attributes/listuri-injector";
import { documentId, fileStem, formatMoney } from "../totals/auto-totals";
import type { NoteCanonical } from "../types/note-canonical";
import { assertNoteCanonical } from "../types/note-canonical";

const NS = {
  creditNote: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
  debitNote: "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
} as const;

export interface BuildNoteXmlResult {
  xml: string;
  fileStem: string;
}

function appendTaxAndMonetary(
  root: ReturnType<ReturnType<typeof create>["ele"]>,
  canonical: NoteCanonical,
  monetaryTag: "cac:LegalMonetaryTotal" | "cac:RequestedMonetaryTotal",
): void {
  const cur = canonical.currency;
  appendDocumentTaxes(root, canonical.totals, cur);

  const monetary = root.ele(monetaryTag);
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
}

function buildNoteXml(
  input: NoteCanonical,
  rootName: "CreditNote" | "DebitNote",
  xmlns: string,
  lineTag: "cac:CreditNoteLine" | "cac:DebitNoteLine",
  qtyTag: "cbc:CreditedQuantity" | "cbc:DebitedQuantity",
): BuildNoteXmlResult {
  const canonical = assertNoteCanonical(input);
  if (
    (rootName === "CreditNote" && canonical.document_type !== "07") ||
    (rootName === "DebitNote" && canonical.document_type !== "08")
  ) {
    throw new Error(`document_type ${canonical.document_type} incompatible with ${rootName}`);
  }

  const id = documentId(canonical.serie, canonical.number);
  const stem = fileStem(
    canonical.supplier.identity_number,
    canonical.document_type,
    canonical.serie,
    canonical.number,
  );
  const cur = canonical.currency;
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele(rootName, {
    xmlns,
    "xmlns:cac": NS.cac,
    "xmlns:cbc": NS.cbc,
    "xmlns:ds": NS.ds,
    "xmlns:ext": NS.ext,
  });

  root.ele("cbc:UBLVersionID").txt("2.1").up();
  root.ele("cbc:CustomizationID").txt("2.0").up();
  root.ele("cbc:ID").txt(id).up();
  root.ele("cbc:IssueDate").txt(canonical.issue_date).up();
  if (canonical.issue_time) root.ele("cbc:IssueTime").txt(canonical.issue_time);
  appendLegends(root, canonical);
  root.ele("cbc:DocumentCurrencyCode", ListUri.currency()).txt(cur).up();

  const discrepancy = root.ele("cac:DiscrepancyResponse");
  discrepancy
    .ele("cbc:ReferenceID")
    .txt(canonical.affected_document.serie_number.toUpperCase())
    .up();
  discrepancy
    .ele("cbc:ResponseCode", {
      listAgencyName: "PE:SUNAT",
      listName:
        canonical.document_type === "07"
          ? "SUNAT:Identificador de tipo de nota de credito"
          : "SUNAT:Identificador de tipo de nota de debito",
      listURI:
        canonical.document_type === "07"
          ? "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo09"
          : "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo10",
    })
    .txt(canonical.note_type)
    .up();
  discrepancy.ele("cbc:Description").txt(canonical.reason).up();

  if (canonical.purchase_order)
    root.ele("cac:OrderReference").ele("cbc:ID").txt(canonical.purchase_order);
  const billing = root.ele("cac:BillingReference").ele("cac:InvoiceDocumentReference");
  billing.ele("cbc:ID").txt(canonical.affected_document.serie_number.toUpperCase()).up();
  billing
    .ele("cbc:DocumentTypeCode", ListUri.invoiceTypeCode())
    .txt(canonical.affected_document.document_type)
    .up();

  appendCpeParty(root, "cac:AccountingSupplierParty", canonical.supplier, true);
  appendCpeParty(root, "cac:AccountingCustomerParty", canonical.customer);
  appendTaxAndMonetary(
    root,
    canonical,
    rootName === "DebitNote" ? "cac:RequestedMonetaryTotal" : "cac:LegalMonetaryTotal",
  );

  for (const line of canonical.lines) {
    const noteLine = root.ele(lineTag);
    noteLine.ele("cbc:ID").txt(String(line.id)).up();
    noteLine
      .ele(qtyTag, ListUri.invoicedQuantity(line.unit_code))
      .txt(formatUnit(line.quantity, 0))
      .up();
    noteLine
      .ele("cbc:LineExtensionAmount", { currencyID: cur })
      .txt(formatMoney(line.line_extension_amount))
      .up();

    const pricing = noteLine.ele("cac:PricingReference").ele("cac:AlternativeConditionPrice");
    pricing
      .ele("cbc:PriceAmount", { currencyID: cur })
      .txt(formatUnit(line.is_free ? line.unit_value : line.unit_price))
      .up();
    pricing
      .ele("cbc:PriceTypeCode", ListUri.priceTypeCode())
      .txt(line.is_free ? "02" : "01")
      .up();

    appendCpeLineTaxes(noteLine, line, cur);

    appendCpeItem(noteLine, line);
    noteLine
      .ele("cac:Price")
      .ele("cbc:PriceAmount", { currencyID: cur })
      .txt(formatUnit(line.is_free ? 0 : line.unit_value))
      .up()
      .up();
  }

  const xml = root.end({ prettyPrint: true, indent: "  ", newline: "\n" });
  return { xml, fileStem: stem };
}

/** Deterministic unsigned CreditNote UBL 2.1 builder (dict 14). */
export class XmlCreditNoteBuilder {
  build(input: NoteCanonical): BuildNoteXmlResult {
    return buildNoteXml(
      { ...input, document_type: "07" },
      "CreditNote",
      NS.creditNote,
      "cac:CreditNoteLine",
      "cbc:CreditedQuantity",
    );
  }
}

/** Deterministic unsigned DebitNote UBL 2.1 builder (dict 15). */
export class XmlDebitNoteBuilder {
  build(input: NoteCanonical): BuildNoteXmlResult {
    return buildNoteXml(
      { ...input, document_type: "08" },
      "DebitNote",
      NS.debitNote,
      "cac:DebitNoteLine",
      "cbc:DebitedQuantity",
    );
  }
}
