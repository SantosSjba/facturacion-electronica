import AdmZip from "adm-zip";
export const TEST_GRE_QR =
  "https://e-factura.sunat.gob.pe/v1/contribuyente/gre/comprobantes/descargaqr?hash=fixture";
export function greCdrFixture(code = "0", id = "T001-00000001", qr = TEST_GRE_QR, note = "") {
  const zip = new AdmZip();
  zip.addFile(
    "R-CDR.xml",
    Buffer.from(`<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    ${note ? `<cbc:Note>${note}</cbc:Note>` : ""}
    <cac:ReceiverParty><cac:PartyIdentification><cbc:ID>20601234567</cbc:ID></cac:PartyIdentification></cac:ReceiverParty>
    <cac:DocumentResponse><cac:Response><cbc:ResponseCode>${code}</cbc:ResponseCode><cbc:Description>Resultado de prueba</cbc:Description></cac:Response>
    <cac:DocumentReference><cbc:ID>${id}</cbc:ID><cbc:DocumentDescription>${qr.replace(/&/g, "&amp;")}</cbc:DocumentDescription></cac:DocumentReference></cac:DocumentResponse>
  </ApplicationResponse>`),
  );
  return zip.toBuffer();
}
