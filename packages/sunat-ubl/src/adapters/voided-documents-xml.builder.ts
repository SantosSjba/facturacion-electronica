import { create } from "xmlbuilder2";

const NS = {
  voided:
    "urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  sac: "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1",
} as const;

export interface VoidedDocumentLineCanonical {
  line_id: number;
  document_type: string;
  serie: string;
  number: number;
  reason: string;
}

export interface VoidedDocumentsCanonical {
  id: string;
  reference_date: string;
  issue_date: string;
  supplier: {
    identity_type: string;
    identity_number: string;
    name: string;
  };
  lines: VoidedDocumentLineCanonical[];
}

export interface BuildVoidedDocumentsXmlResult {
  xml: string;
  fileStem: string;
  id: string;
}

/**
 * Unsigned VoidedDocuments (RA) UBL 2.0 builder — dict 19.
 */
export class XmlVoidedDocumentsBuilder {
  build(input: VoidedDocumentsCanonical): BuildVoidedDocumentsXmlResult {
    if (!input.lines?.length) {
      throw new Error("VoidedDocuments requires at least one line");
    }

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele(
      "VoidedDocuments",
      {
        xmlns: NS.voided,
        "xmlns:cac": NS.cac,
        "xmlns:cbc": NS.cbc,
        "xmlns:ds": NS.ds,
        "xmlns:ext": NS.ext,
        "xmlns:sac": NS.sac,
      },
    );

    root.ele("cbc:UBLVersionID").txt("2.0").up();
    root.ele("cbc:CustomizationID").txt("1.0").up();
    root.ele("cbc:ID").txt(input.id).up();
    root.ele("cbc:ReferenceDate").txt(input.reference_date).up();
    root.ele("cbc:IssueDate").txt(input.issue_date).up();

    // Signature placeholder node (XmlCryptoSignAdapter fills UBLExtensions + ds)
    const sig = root.ele("cac:Signature");
    sig.ele("cbc:ID").txt("SignFactosys").up();
    const sigParty = sig.ele("cac:SignatoryParty").ele("cac:PartyIdentification");
    sigParty
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
      const node = root.ele("sac:VoidedDocumentsLine");
      node.ele("cbc:LineID").txt(String(line.line_id)).up();
      node.ele("cbc:DocumentTypeCode").txt(line.document_type).up();
      node.ele("sac:DocumentSerialID").txt(line.serie.toUpperCase()).up();
      node.ele("sac:DocumentNumberID").txt(String(line.number)).up();
      node.ele("sac:VoidReasonDescription").txt(line.reason).up();
    }

    const dateCompact = input.reference_date.replace(/-/g, "");
    const correlative = input.id.split("-").pop() ?? "1";
    const fileStem = `${input.supplier.identity_number}-RA-${dateCompact}-${Number(correlative)}`;

    const xml = root.end({ prettyPrint: true, indent: "  ", newline: "\n" });
    return { xml, fileStem, id: input.id };
  }
}
