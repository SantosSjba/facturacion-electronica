/**
 * QR payload per SUNAT RI anexos (pipe-separated):
 * RUC | tipo | serie | número | IGV | total | fecha | tipoDocAdq | numDocAdq | DigestValue
 */
export interface QrPayloadInput {
  ruc: string;
  documentType: string;
  serie: string;
  number: string;
  igv: string;
  total: string;
  issueDate: string;
  customerIdentityType: string;
  customerIdentityNumber: string;
  digestValue: string;
}

export function buildQrPayload(input: QrPayloadInput): string {
  return [
    input.ruc,
    input.documentType,
    input.serie,
    input.number,
    input.igv,
    input.total,
    input.issueDate,
    input.customerIdentityType,
    input.customerIdentityNumber,
    input.digestValue,
  ].join("|");
}

/** Extract first ds:DigestValue from signed XML. */
export function extractDigestValue(signedXml: string): string | null {
  const m =
    /<[^:>]*:?DigestValue[^>]*>([^<]+)<\/[^:>]*:?DigestValue>/i.exec(
      signedXml,
    );
  return m?.[1]?.trim() ?? null;
}
