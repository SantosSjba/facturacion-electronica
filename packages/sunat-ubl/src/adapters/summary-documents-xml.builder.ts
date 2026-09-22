import { create } from "xmlbuilder2";

import { formatMoney } from "../totals/auto-totals";

const NS = {
  summary:
    "urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  sac: "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1",
} as const;

export interface SummaryLineTotalsCanonical {
  gravadas: number;
  exoneradas: number;
  inafectas: number;
  gratuitas?: number;
  igv: number;
  isc?: number;
  other_charges?: number;
  payable: number;
}

export interface SummaryDocumentsLineCanonical {
  line_id: number;
  document_type: "03" | "07" | "08";
  serie_number: string;
  status: "1" | "2" | "3";
  customer: {
    identity_type: string;
    identity_number: string;
  };
  totals: SummaryLineTotalsCanonical;
  affected_document?: {
    document_type: string;
    serie_number: string;
  };
}

export interface SummaryDocumentsCanonical {
  id: string;
  reference_date: string;
  issue_date: string;
  supplier: {
    identity_type: string;
    identity_number: string;
    name: string;
  };
  lines: SummaryDocumentsLineCanonical[];
}

export interface BuildSummaryDocumentsXmlResult {
  xml: string;
  fileStem: string;
  id: string;
}

/**
 * Unsigned SummaryDocuments (RC) UBL 2.0 CustomizationID 1.1 — dict 20.
 */
export class XmlSummaryDocumentsBuilder {
  build(input: SummaryDocumentsCanonical): BuildSummaryDocumentsXmlResult {
    if (!input.lines?.length) {
      throw new Error("SummaryDocuments requires at least one line");
    }

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele(
      "SummaryDocuments",
      {
        xmlns: NS.summary,
        "xmlns:cac": NS.cac,
        "xmlns:cbc": NS.cbc,
        "xmlns:ds": NS.ds,
        "xmlns:ext": NS.ext,
        "xmlns:sac": NS.sac,
      },
    );

    root.ele("cbc:UBLVersionID").txt("2.0").up();
    root.ele("cbc:CustomizationID").txt("1.1").up();
    root.ele("cbc:ID").txt(input.id).up();
    root.ele("cbc:ReferenceDate").txt(input.reference_date).up();
    root.ele("cbc:IssueDate").txt(input.issue_date).up();

    const sig = root.ele("cac:Signature");
    sig.ele("cbc:ID").txt("SignFactosys").up();
    sig
      .ele("cac:SignatoryParty")
      .ele("cac:PartyIdentification")
      .ele("cbc:ID")
      .txt(input.supplier.identity_number)
      .up()
      .up()
      .up();
    sig
      .ele("cac:DigitalSignatureAttachment")
      .ele("cac:ExternalReference")
      .ele("cbc:URI")
      .txt("#SignFactosys")
      .up()
      .up()
      .up();

    const supplier = root.ele("cac:AccountingSupplierParty");
    supplier
      .ele("cbc:CustomerAssignedAccountID")
      .txt(input.supplier.identity_number)
      .up();
    supplier
      .ele("cbc:AdditionalAccountID")
      .txt(input.supplier.identity_type)
      .up();
    supplier
      .ele("cac:Party")
      .ele("cac:PartyLegalEntity")
      .ele("cbc:RegistrationName")
      .txt(input.supplier.name)
      .up()
      .up()
      .up();

    for (const line of input.lines) {
      const node = root.ele("sac:SummaryDocumentsLine");
      node.ele("cbc:LineID").txt(String(line.line_id)).up();
      node.ele("cbc:DocumentTypeCode").txt(line.document_type).up();
      node.ele("cbc:ID").txt(line.serie_number.toUpperCase()).up();

      const customer = node.ele("cac:AccountingCustomerParty");
      customer
        .ele("cbc:CustomerAssignedAccountID")
        .txt(line.customer.identity_number)
        .up();
      customer
        .ele("cbc:AdditionalAccountID")
        .txt(line.customer.identity_type)
        .up();

      node.ele("cac:Status").ele("cbc:ConditionCode").txt(line.status).up().up();

      node
        .ele("sac:TotalAmount", { currencyID: "PEN" })
        .txt(formatMoney(line.totals.payable))
        .up();

      appendBillingPayment(node, line.totals.gravadas, "01");
      appendBillingPayment(node, line.totals.exoneradas, "02");
      appendBillingPayment(node, line.totals.inafectas, "03");
      if (line.totals.gratuitas != null && line.totals.gratuitas > 0) {
        appendBillingPayment(node, line.totals.gratuitas, "05");
      }

      const tax = node.ele("cac:TaxTotal");
      tax
        .ele("cbc:TaxAmount", { currencyID: "PEN" })
        .txt(formatMoney(line.totals.igv))
        .up();
      const sub = tax.ele("cac:TaxSubtotal");
      sub
        .ele("cbc:TaxAmount", { currencyID: "PEN" })
        .txt(formatMoney(line.totals.igv))
        .up();
      const cat = sub.ele("cac:TaxCategory");
      const scheme = cat.ele("cac:TaxScheme");
      scheme.ele("cbc:ID").txt("1000").up();
      scheme.ele("cbc:Name").txt("IGV").up();
      scheme.ele("cbc:TaxTypeCode").txt("VAT").up();

      if (line.affected_document) {
        const ref = node.ele("cac:BillingReference").ele("cac:InvoiceDocumentReference");
        ref.ele("cbc:ID").txt(line.affected_document.serie_number.toUpperCase()).up();
        ref
          .ele("cbc:DocumentTypeCode")
          .txt(line.affected_document.document_type)
          .up();
      }
    }

    const dateCompact = input.reference_date.replace(/-/g, "");
    const correlative = input.id.split("-").pop() ?? "1";
    const fileStem = `${input.supplier.identity_number}-RC-${dateCompact}-${Number(correlative)}`;

    const xml = root.end({ prettyPrint: true, indent: "  ", newline: "\n" });
    return { xml, fileStem, id: input.id };
  }
}

function appendBillingPayment(
  parent: ReturnType<ReturnType<typeof create>["ele"]>,
  amount: number,
  instructionId: string,
): void {
  if (amount <= 0) return;
  const pay = parent.ele("sac:BillingPayment");
  pay
    .ele("cbc:PaidAmount", { currencyID: "PEN" })
    .txt(formatMoney(amount))
    .up();
  pay.ele("cbc:InstructionID").txt(instructionId).up();
}
