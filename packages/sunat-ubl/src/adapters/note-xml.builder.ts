import { create } from "xmlbuilder2";

import { ListUri } from "../attributes/listuri-injector";
import {
  documentId,
  fileStem,
  formatMoney,
} from "../totals/auto-totals";
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

function appendParty(
  root: ReturnType<ReturnType<typeof create>["ele"]>,
  tag: "cac:AccountingSupplierParty" | "cac:AccountingCustomerParty",
  party: NoteCanonical["supplier"],
  opts: { establishmentCode?: string } = {},
): void {
  const node = root.ele(tag).ele("cac:Party");
  node
    .ele("cac:PartyIdentification")
    .ele("cbc:ID", { schemeID: party.identity_type })
    .txt(party.identity_number)
    .up()
    .up();
  const taxScheme = node.ele("cac:PartyTaxScheme");
  taxScheme
    .ele("cbc:CompanyID", ListUri.companyId(party.identity_type))
    .txt(party.identity_number)
    .up();
  taxScheme.ele("cac:TaxScheme").ele("cbc:ID").txt("1000").up().up();
  const legal = node.ele("cac:PartyLegalEntity");
  legal.ele("cbc:RegistrationName").txt(party.name).up();
  if (opts.establishmentCode) {
    legal
      .ele("cac:RegistrationAddress")
      .ele("cbc:AddressTypeCode", {
        listAgencyName: "PE:SUNAT",
        listName: "SUNAT:Identificador de establecimiento",
        listURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo54",
      })
      .txt(opts.establishmentCode)
      .up()
      .up();
  }
}

function appendTaxAndMonetary(
  root: ReturnType<ReturnType<typeof create>["ele"]>,
  canonical: NoteCanonical,
  monetaryTag: "cac:LegalMonetaryTotal" | "cac:RequestedMonetaryTotal",
): void {
  const cur = canonical.currency;
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

function appendLineTaxes(
  lineNode: ReturnType<ReturnType<typeof create>["ele"]>,
  line: NoteCanonical["lines"][0],
  canonical: NoteCanonical,
): void {
  const cur = canonical.currency;
  const lineTax = lineNode.ele("cac:TaxTotal");
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
    throw new Error(
      `document_type ${canonical.document_type} incompatible with ${rootName}`,
    );
  }

  const id = documentId(canonical.serie, canonical.number);
  const stem = fileStem(
    canonical.supplier.identity_number,
    canonical.document_type,
    canonical.serie,
    canonical.number,
  );
  const cur = canonical.currency;
  const line = canonical.lines[0];
  if (!line) {
    throw new Error("NoteCanonical requires at least one line");
  }

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

  const billing = root.ele("cac:BillingReference").ele("cac:InvoiceDocumentReference");
  billing
    .ele("cbc:ID")
    .txt(canonical.affected_document.serie_number.toUpperCase())
    .up();
  billing
    .ele("cbc:DocumentTypeCode", ListUri.invoiceTypeCode())
    .txt(canonical.affected_document.document_type)
    .up();

  appendParty(root, "cac:AccountingSupplierParty", canonical.supplier, {
    establishmentCode: "0000",
  });
  appendParty(root, "cac:AccountingCustomerParty", canonical.customer);
  appendTaxAndMonetary(
    root,
    canonical,
    rootName === "DebitNote"
      ? "cac:RequestedMonetaryTotal"
      : "cac:LegalMonetaryTotal",
  );

  const noteLine = root.ele(lineTag);
  noteLine.ele("cbc:ID").txt(String(line.id)).up();
  noteLine
    .ele(qtyTag, ListUri.invoicedQuantity(line.unit_code))
    .txt(String(line.quantity))
    .up();
  noteLine
    .ele("cbc:LineExtensionAmount", { currencyID: cur })
    .txt(formatMoney(line.line_extension_amount))
    .up();

  const pricing = noteLine
    .ele("cac:PricingReference")
    .ele("cac:AlternativeConditionPrice");
  pricing
    .ele("cbc:PriceAmount", { currencyID: cur })
    .txt(formatMoney(line.unit_price))
    .up();
  pricing.ele("cbc:PriceTypeCode", ListUri.priceTypeCode()).txt("01").up();

  appendLineTaxes(noteLine, line, canonical);

  noteLine.ele("cac:Item").ele("cbc:Description").txt(line.description).up().up();
  noteLine
    .ele("cac:Price")
    .ele("cbc:PriceAmount", { currencyID: cur })
    .txt(formatMoney(line.unit_value))
    .up()
    .up();

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
