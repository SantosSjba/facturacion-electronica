import { create } from "xmlbuilder2";
import { DOMParser } from "@xmldom/xmldom";

import { soapTransportError, soapTransportInternal } from "../errors";
import type { BillServicePort } from "../ports/bill-service.port";
import type {
  SendBillInput,
  SendBillResult,
} from "../ports/bill-service.types";

export const DEFAULT_BETA_WSDL =
  "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService?wsdl";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface SoapBillServiceOptions {
  /** Full WSDL URL; POST goes to the same path without `?wsdl`. */
  wsdlUrl?: string;
  /** Injectable for tests (default: global fetch). */
  fetchImpl?: FetchLike;
  /** Request timeout ms (default 60_000). */
  timeoutMs?: number;
}

/**
 * Real SOAP 1.1 SendBill with WS-Security UsernameToken (doc 24 §C.1).
 * Does not depend on node-soap / WSDL parse — handcrafted envelope.
 */
export class SoapBillServiceAdapter implements BillServicePort {
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: SoapBillServiceOptions = {}) {
    const wsdl = options.wsdlUrl ?? process.env.SUNAT_SEE_WSDL_URL ?? DEFAULT_BETA_WSDL;
    this.endpoint = wsdlUrlToEndpoint(wsdl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async sendBill(input: SendBillInput): Promise<SendBillResult> {
    if (!input?.zipBytes?.length) {
      throw soapTransportError("zipBytes is empty");
    }
    if (!input.fileName?.trim()) {
      throw soapTransportError("fileName is required");
    }
    if (!input.solUser?.trim()) {
      throw soapTransportError(
        "SOL user is required for beta SendBill (set SUNAT_SOL_USER)",
      );
    }
    if (!input.solPassword) {
      throw soapTransportError(
        "SOL password is required for beta SendBill (set SUNAT_SOL_PASSWORD)",
      );
    }

    const envelope = buildSendBillEnvelope({
      fileName: input.fileName,
      contentBase64: input.zipBytes.toString("base64"),
      solUser: input.solUser,
      solPassword: input.solPassword,
    });

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: '""',
          },
          body: envelope,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (cause) {
      const aborted =
        cause instanceof Error &&
        (cause.name === "AbortError" || cause.message.includes("abort"));
      throw soapTransportError(
        aborted ? "SUNAT SendBill timed out" : "SUNAT SendBill network error",
        { cause },
      );
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw soapTransportError(
        `SUNAT SendBill HTTP ${response.status}`,
        {
          details: [
            {
              path: "http",
              issue: `status ${response.status}`,
            },
          ],
        },
      );
    }

    if (/Fault/i.test(bodyText) && /soap/i.test(bodyText)) {
      const faultMsg = extractFaultString(bodyText) ?? "SOAP Fault from SUNAT";
      throw soapTransportError(faultMsg, {
        details: [{ path: "soap", issue: "Fault" }],
      });
    }

    const cdrBase64 = extractApplicationResponseBase64(bodyText);
    if (!cdrBase64) {
      throw soapTransportInternal(
        "SendBill response missing applicationResponse base64",
      );
    }

    let rawCdrZip: Buffer;
    try {
      rawCdrZip = Buffer.from(cdrBase64, "base64");
    } catch (cause) {
      throw soapTransportInternal("Invalid applicationResponse base64", {
        cause,
      });
    }

    if (!rawCdrZip.length) {
      throw soapTransportInternal("Decoded CDR ZIP is empty");
    }

    return { rawCdrZip };
  }
}

export function wsdlUrlToEndpoint(wsdlUrl: string): string {
  return wsdlUrl.replace(/\?wsdl$/i, "").replace(/\/$/, "");
}

function buildSendBillEnvelope(params: {
  fileName: string;
  contentBase64: string;
  solUser: string;
  solPassword: string;
}): string {
  const env = create({ version: "1.0", encoding: "UTF-8" }).ele(
    "soapenv:Envelope",
    {
      "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
      "xmlns:ser": "http://service.sunat.gob.pe",
      "xmlns:wsse":
        "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
    },
  );

  const security = env
    .ele("soapenv:Header")
    .ele("wsse:Security")
    .ele("wsse:UsernameToken");
  security.ele("wsse:Username").txt(params.solUser).up();
  security.ele("wsse:Password").txt(params.solPassword).up();

  const body = env.ele("soapenv:Body").ele("ser:sendBill");
  body.ele("fileName").txt(params.fileName).up();
  body.ele("contentFile").txt(params.contentBase64).up();

  return env.end({ prettyPrint: false });
}

function extractApplicationResponseBase64(soapXml: string): string | null {
  const doc = new DOMParser().parseFromString(soapXml, "text/xml");
  const nodes = doc.getElementsByTagName("*");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.item(i);
    if (!el) continue;
    const name = el.localName || el.nodeName;
    if (
      name === "applicationResponse" ||
      name.endsWith(":applicationResponse")
    ) {
      return (el.textContent ?? "").trim() || null;
    }
  }
  return null;
}

function extractFaultString(soapXml: string): string | null {
  const doc = new DOMParser().parseFromString(soapXml, "text/xml");
  const nodes = doc.getElementsByTagName("*");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.item(i);
    if (!el) continue;
    const name = el.localName || el.nodeName;
    if (name === "faultstring" || name.endsWith(":faultstring")) {
      return (el.textContent ?? "").trim() || null;
    }
  }
  return null;
}
