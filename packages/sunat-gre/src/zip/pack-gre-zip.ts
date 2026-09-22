import { createHash } from "node:crypto";

import AdmZip from "adm-zip";

import { greTransportError } from "../errors";

export type GreDocumentType = "09" | "31";

export interface PackGreZipInput {
  ruc: string;
  documentType: GreDocumentType;
  serie: string;
  number: number;
  xml: string;
}

export interface PackGreZipResult {
  zipBytes: Buffer;
  fileName: string;
  fileStem: string;
  /** SHA-256 hex of zipBytes (SUNAT hashZip). */
  hashZip: string;
}

/**
 * GRE wire ZIP: `{RUC}-{09|31}-{SERIE}-{N}.zip` with matching XML entry.
 */
export function packGreZip(input: PackGreZipInput): PackGreZipResult {
  const ruc = input.ruc.trim();
  if (!/^\d{11}$/.test(ruc)) {
    throw greTransportError("Invalid RUC for GRE ZIP (expected 11 digits)", {
      details: [{ path: "ruc", issue: "must be 11 digits" }],
    });
  }
  if (!input.xml?.trim()) {
    throw greTransportError("XML to pack is empty");
  }

  const serie = input.serie.trim().toUpperCase();
  const fileStem = `${ruc}-${input.documentType}-${serie}-${input.number}`;
  const fileName = `${fileStem}.zip`;
  const xmlEntry = `${fileStem}.xml`;

  const zip = new AdmZip();
  zip.addFile(xmlEntry, Buffer.from(input.xml, "utf8"));
  const zipBytes = zip.toBuffer();
  const hashZip = createHash("sha256").update(zipBytes).digest("hex");

  return { zipBytes, fileName, fileStem, hashZip };
}
