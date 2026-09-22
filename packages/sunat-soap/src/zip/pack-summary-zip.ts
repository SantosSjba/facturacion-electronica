import AdmZip from "adm-zip";

import { soapTransportError } from "../errors";

export type SummaryDocumentKind = "RA" | "RC";

export interface PackSummaryZipInput {
  ruc: string;
  kind: SummaryDocumentKind;
  /** YYYYMMDD */
  referenceDateCompact: string;
  correlative: number;
  xml: string;
}

export interface PackSummaryZipResult {
  zipBytes: Buffer;
  fileName: string;
  fileStem: string;
}

/**
 * SUNAT summary ZIP: `{RUC}-RA|RC-{YYYYMMDD}-{N}.zip` with matching XML entry.
 */
export function packSummaryZip(
  input: PackSummaryZipInput,
): PackSummaryZipResult {
  const ruc = input.ruc.trim();
  if (!/^\d{11}$/.test(ruc)) {
    throw soapTransportError("Invalid RUC for ZIP pack (expected 11 digits)", {
      details: [{ path: "ruc", issue: "must be 11 digits" }],
    });
  }
  if (!/^\d{8}$/.test(input.referenceDateCompact)) {
    throw soapTransportError("referenceDateCompact must be YYYYMMDD", {
      details: [{ path: "referenceDateCompact", issue: "must be 8 digits" }],
    });
  }
  if (!input.xml?.trim()) {
    throw soapTransportError("XML to pack is empty");
  }

  const fileStem = `${ruc}-${input.kind}-${input.referenceDateCompact}-${input.correlative}`;
  const fileName = `${fileStem}.zip`;
  const xmlEntry = `${fileStem}.xml`;

  const zip = new AdmZip();
  zip.addFile(xmlEntry, Buffer.from(input.xml, "utf8"));
  return { zipBytes: zip.toBuffer(), fileName, fileStem };
}
