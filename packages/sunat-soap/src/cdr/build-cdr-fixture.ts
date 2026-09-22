import AdmZip from "adm-zip";
import { create } from "xmlbuilder2";

export type CdrFixtureKind = "accepted" | "accepted_with_observation" | "rejected";

const CODE_BY_KIND: Record<CdrFixtureKind, string> = {
  accepted: "0",
  accepted_with_observation: "98",
  rejected: "2324",
};

const DESC_BY_KIND: Record<CdrFixtureKind, string> = {
  accepted: "La Factura ha sido aceptada",
  accepted_with_observation: "La Factura ha sido aceptada con observaciones",
  rejected: "El documento no cumple con el formato establecido",
};

/**
 * Minimal UBL ApplicationResponse used as CDR body inside a ZIP (Spike C fixtures).
 */
export function buildApplicationResponseXml(
  kind: CdrFixtureKind,
  documentReferenceId = "F001-00000001",
): string {
  const code = CODE_BY_KIND[kind];
  const description = DESC_BY_KIND[kind];
  const today = new Date().toISOString().slice(0, 10);

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele(
    "ar:ApplicationResponse",
    {
      "xmlns:ar":
        "urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2",
      "xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    },
  );

  root.ele("cbc:UBLVersionID").txt("2.0").up();
  root.ele("cbc:CustomizationID").txt("1.0").up();
  root.ele("cbc:ID").txt(`CDR-${documentReferenceId}`).up();
  root.ele("cbc:IssueDate").txt(today).up();
  root.ele("cbc:IssueTime").txt("00:00:00").up();
  root.ele("cbc:ResponseDate").txt(today).up();

  root
    .ele("cac:SenderParty")
    .ele("cac:PartyIdentification")
    .ele("cbc:ID")
    .txt("20131312955")
    .up()
    .up()
    .up();

  root
    .ele("cac:ReceiverParty")
    .ele("cac:PartyIdentification")
    .ele("cbc:ID")
    .txt("20601234567")
    .up()
    .up()
    .up();

  const documentResponse = root.ele("cac:DocumentResponse");
  documentResponse
    .ele("cac:Response")
    .ele("cbc:ResponseCode")
    .txt(code)
    .up()
    .ele("cbc:Description")
    .txt(description)
    .up()
    .up();
  documentResponse
    .ele("cac:DocumentReference")
    .ele("cbc:ID")
    .txt(documentReferenceId)
    .up()
    .up();

  return root.end({ prettyPrint: false });
}

/** Build a CDR ZIP containing one ApplicationResponse XML. */
export function buildCdrZipFixture(
  kind: CdrFixtureKind,
  opts?: { documentReferenceId?: string; xmlEntryName?: string },
): Buffer {
  const xml = buildApplicationResponseXml(
    kind,
    opts?.documentReferenceId ?? "F001-00000001",
  );
  const entry = opts?.xmlEntryName ?? "R-20601234567-01-F001-1.xml";
  const zip = new AdmZip();
  zip.addFile(entry, Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}
