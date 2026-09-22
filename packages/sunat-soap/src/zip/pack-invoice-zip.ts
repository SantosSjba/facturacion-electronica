import AdmZip from "adm-zip";

import { soapTransportError } from "../errors";

export interface PackInvoiceZipInput {
  ruc: string;
  documentType: "01" | "03" | "07" | "08";
  serie: string;
  number: number;
  xml: string;
}

export interface PackInvoiceZipResult {
  zipBytes: Buffer;
  fileName: string;
  /** Stem shared by ZIP and inner XML (without extension). */
  fileStem: string;
}

/**
 * Build SUNAT wire ZIP: one signed XML entry named `{RUC}-{TYPE}-{SERIE}-{N}.xml`
 * inside `{RUC}-{TYPE}-{SERIE}-{N}.zip`.
 */
export function packInvoiceZip(input: PackInvoiceZipInput): PackInvoiceZipResult {
  const ruc = input.ruc.trim();
  if (!/^\d{11}$/.test(ruc)) {
    throw soapTransportError("Invalid RUC for ZIP pack (expected 11 digits)", {
      details: [{ path: "ruc", issue: "must be 11 digits" }],
    });
  }
  if (!input.xml?.trim()) {
    throw soapTransportError("XML to pack is empty");
  }

  const serie = input.serie.trim().toUpperCase();
  const fileStem = `${ruc}-${input.documentType}-${serie}-${input.number}`;
  const fileName = `${fileStem}.zip`;
  const xmlEntry = `${fileStem}.xml`;

  const zip = new AdmZip();
  zip.addFile(xmlEntry, Buffer.from(input.xml, "utf8"));
  const zipBytes = zip.toBuffer();

  return { zipBytes, fileName, fileStem };
}
