import { create } from "xmlbuilder2";
import { DOMParser } from "@xmldom/xmldom";
import { soapTransportError } from "../errors";
import type { FetchLike } from "./soap-bill-service.adapter";

export const DEFAULT_CDR_CONSULT_URL =
  "https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService";
export interface CdrConsultInput {
  ruc: string;
  documentType: string;
  serie: string;
  number: number;
  solUser: string;
  solPassword: string;
}
export interface CdrConsultResult {
  statusCode: string;
  statusMessage?: string;
  rawCdrZip?: Buffer;
}
export class SoapCdrConsultAdapter {
  constructor(
    private readonly options: { endpoint?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
  ) {}
  async getStatusCdr(input: CdrConsultInput): Promise<CdrConsultResult> {
    if (
      !/^\d{11}$/.test(input.ruc) ||
      !["01", "07", "08"].includes(input.documentType) ||
      !/^F[A-Z0-9]{3}$/.test(input.serie) ||
      !Number.isSafeInteger(input.number) ||
      input.number < 1 ||
      !input.solUser ||
      !input.solPassword
    )
      throw soapTransportError("Unsupported or incomplete CDR identifiers");
    const root = create().ele("soapenv:Envelope", {
      "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
      "xmlns:ser": "http://service.sunat.gob.pe",
      "xmlns:wsse":
        "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
    });
    const security = root.ele("soapenv:Header").ele("wsse:Security").ele("wsse:UsernameToken");
    security.ele("wsse:Username").txt(input.solUser);
    security.ele("wsse:Password").txt(input.solPassword);
    const body = root.ele("soapenv:Body").ele("ser:getStatusCdr");
    for (const [key, value] of Object.entries({
      rucComprobante: input.ruc,
      tipoComprobante: input.documentType,
      serieComprobante: input.serie,
      numeroComprobante: input.number,
    }))
      body.ele(key).txt(String(value));
    let response: Response;
    try {
      response = await (this.options.fetchImpl ?? fetch)(
        this.options.endpoint ?? DEFAULT_CDR_CONSULT_URL,
        {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
          body: root.end(),
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 30000),
        },
      );
    } catch (cause) {
      throw soapTransportError("SUNAT CDR consultation transport failure", { cause });
    }
    const text = await response.text();
    if (!response.ok || /<!DOCTYPE|<!ENTITY/i.test(text))
      throw soapTransportError("SUNAT CDR consultation HTTP " + response.status);
    const doc = new DOMParser({
      onError: () => {
        throw soapTransportError("Malformed SUNAT CDR consultation response");
      },
    }).parseFromString(text, "application/xml");
    const get = (name: string) => doc.getElementsByTagNameNS("*", name)[0]?.textContent?.trim();
    if (get("faultstring")) throw soapTransportError("SUNAT CDR consultation SOAP fault");
    const statusCode = get("statusCode");
    if (!statusCode) throw soapTransportError("SUNAT CDR consultation missing statusCode");
    const encoded = get("content");
    if (encoded && (encoded.length > 4_000_000 || !/^[A-Za-z0-9+/=\s]+$/.test(encoded)))
      throw soapTransportError("Invalid SUNAT CDR content");
    return {
      statusCode,
      statusMessage: get("statusMessage"),
      rawCdrZip: encoded ? Buffer.from(encoded, "base64") : undefined,
    };
  }
}
