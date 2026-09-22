import { create } from "xmlbuilder2";
import { DOMParser } from "@xmldom/xmldom";

import { soapTransportError, soapTransportInternal } from "../errors";
import type { BillServicePort } from "../ports/bill-service.port";
import type {
  GetStatusInput,
  GetStatusResult,
  SendBillInput,
  SendBillResult,
  SendSummaryInput,
  SendSummaryResult,
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
 * Real SOAP 1.1 SendBill / sendSummary / getStatus with WS-Security UsernameToken.
 * Does not depend on node-soap / WSDL parse — handcrafted envelopes.
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
    assertSolCredentials(input.solUser, input.solPassword, "SendBill");
    if (!input?.zipBytes?.length) {
      throw soapTransportError("zipBytes is empty");
    }
    if (!input.fileName?.trim()) {
      throw soapTransportError("fileName is required");
    }

    const bodyText = await this.postEnvelope(
      buildSendBillEnvelope({
        fileName: input.fileName,
        contentBase64: input.zipBytes.toString("base64"),
        solUser: input.solUser,
        solPassword: input.solPassword,
      }),
      "SendBill",
    );

    return { rawCdrZip: decodeApplicationResponseZip(bodyText, "SendBill") };
  }

  async sendSummary(input: SendSummaryInput): Promise<SendSummaryResult> {
    assertSolCredentials(input.solUser, input.solPassword, "sendSummary");
    if (!input?.zipBytes?.length) {
      throw soapTransportError("zipBytes is empty");
    }
    if (!input.fileName?.trim()) {
      throw soapTransportError("fileName is required");
    }

    const bodyText = await this.postEnvelope(
      buildSendSummaryEnvelope({
        fileName: input.fileName,
        contentBase64: input.zipBytes.toString("base64"),
        solUser: input.solUser,
        solPassword: input.solPassword,
      }),
      "sendSummary",
    );

    const ticket = extractTicket(bodyText);
    if (!ticket) {
      throw soapTransportInternal("sendSummary response missing ticket");
    }
    return { ticket };
  }

  async getStatus(input: GetStatusInput): Promise<GetStatusResult> {
    assertSolCredentials(input.solUser, input.solPassword, "getStatus");
    if (!input.ticket?.trim()) {
      throw soapTransportError("ticket is required");
    }

    const bodyText = await this.postEnvelope(
      buildGetStatusEnvelope({
        ticket: input.ticket,
        solUser: input.solUser,
        solPassword: input.solPassword,
      }),
      "getStatus",
    );

    return { rawCdrZip: decodeApplicationResponseZip(bodyText, "getStatus") };
  }

  private async postEnvelope(
    envelope: string,
    operation: string,
  ): Promise<string> {
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
        aborted
          ? `SUNAT ${operation} timed out`
          : `SUNAT ${operation} network error`,
        { cause },
      );
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw soapTransportError(`SUNAT ${operation} HTTP ${response.status}`, {
        details: [
          {
            path: "http",
            issue: `status ${response.status}`,
          },
        ],
      });
    }

    if (/Fault/i.test(bodyText) && /soap/i.test(bodyText)) {
      const faultMsg = extractFaultString(bodyText) ?? "SOAP Fault from SUNAT";
      throw soapTransportError(faultMsg, {
        details: [{ path: "soap", issue: "Fault" }],
      });
    }

    return bodyText;
  }
}

export function wsdlUrlToEndpoint(wsdlUrl: string): string {
  return wsdlUrl.replace(/\?wsdl$/i, "").replace(/\/$/, "");
}

function assertSolCredentials(
  solUser: string,
  solPassword: string,
  operation: string,
): void {
  if (!solUser?.trim()) {
    throw soapTransportError(
      `SOL user is required for beta ${operation} (set SUNAT_SOL_USER)`,
    );
  }
  if (!solPassword) {
    throw soapTransportError(
      `SOL password is required for beta ${operation} (set SUNAT_SOL_PASSWORD)`,
    );
  }
}

function buildWsseEnvelopeRoot(params: {
  solUser: string;
  solPassword: string;
}) {
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
  return env;
}

function buildSendBillEnvelope(params: {
  fileName: string;
  contentBase64: string;
  solUser: string;
  solPassword: string;
}): string {
  const env = buildWsseEnvelopeRoot(params);
  const body = env.ele("soapenv:Body").ele("ser:sendBill");
  body.ele("fileName").txt(params.fileName).up();
  body.ele("contentFile").txt(params.contentBase64).up();
  return env.end({ prettyPrint: false });
}

function buildSendSummaryEnvelope(params: {
  fileName: string;
  contentBase64: string;
  solUser: string;
  solPassword: string;
}): string {
  const env = buildWsseEnvelopeRoot(params);
  const body = env.ele("soapenv:Body").ele("ser:sendSummary");
  body.ele("fileName").txt(params.fileName).up();
  body.ele("contentFile").txt(params.contentBase64).up();
  return env.end({ prettyPrint: false });
}

function buildGetStatusEnvelope(params: {
  ticket: string;
  solUser: string;
  solPassword: string;
}): string {
  const env = buildWsseEnvelopeRoot(params);
  const body = env.ele("soapenv:Body").ele("ser:getStatus");
  body.ele("ticket").txt(params.ticket).up();
  return env.end({ prettyPrint: false });
}

function decodeApplicationResponseZip(
  bodyText: string,
  operation: string,
): Buffer {
  const cdrBase64 =
    extractElementText(bodyText, "applicationResponse") ??
    extractElementText(bodyText, "content");
  if (!cdrBase64) {
    throw soapTransportInternal(
      `${operation} response missing applicationResponse/content base64`,
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
  return rawCdrZip;
}

function extractTicket(soapXml: string): string | null {
  return extractElementText(soapXml, "ticket");
}

function extractElementText(
  soapXml: string,
  localName: string,
): string | null {
  const doc = new DOMParser().parseFromString(soapXml, "text/xml");
  const nodes = doc.getElementsByTagName("*");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.item(i);
    if (!el) continue;
    const name = el.localName || el.nodeName;
    if (name === localName || name.endsWith(`:${localName}`)) {
      return (el.textContent ?? "").trim() || null;
    }
  }
  return null;
}

function extractFaultString(soapXml: string): string | null {
  return extractElementText(soapXml, "faultstring");
}
