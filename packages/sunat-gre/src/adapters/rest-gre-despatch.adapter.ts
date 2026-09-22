import { createHash } from "node:crypto";

import type {
  GreDespatchPort,
  GreGetStatusInput,
  GreGetStatusResult,
  GreSendDespatchInput,
  GreSendDespatchResult,
  GreTicketStatus,
} from "../ports/gre-despatch.port";
import { greTransportError } from "../errors";
import type { FetchLike } from "./rest-gre-oauth.adapter";

export const DEFAULT_GRE_API_BASE = "https://api-cpe.sunat.gob.pe";

export interface RestGreDespatchOptions {
  apiBase?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/**
 * Real GRE REST send + consultarTicket.
 */
export class RestGreDespatchAdapter implements GreDespatchPort {
  private readonly apiBase: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: RestGreDespatchOptions = {}) {
    this.apiBase = (
      options.apiBase ??
      process.env.SUNAT_GRE_API_BASE ??
      DEFAULT_GRE_API_BASE
    ).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async sendDespatch(
    input: GreSendDespatchInput,
  ): Promise<GreSendDespatchResult> {
    assertToken(input.accessToken);
    if (!input.zipBytes?.length) {
      throw greTransportError("zipBytes is empty");
    }
    const serie = input.serie.trim().toUpperCase();
    const pathId = `${input.ruc}-${input.documentType}-${serie}-${input.number}`;
    const url = `${this.apiBase}/v1/contribuyente/gem/comprobantes/${pathId}`;

    const hashZip = createHash("sha256").update(input.zipBytes).digest("hex");
    const nomArchivo = input.fileName.endsWith(".zip")
      ? input.fileName
      : `${input.fileName}.zip`;

    const payload = {
      archivo: {
        nomArchivo,
        arcGreZip: input.zipBytes.toString("base64"),
        hashZip,
      },
    };

    const { response, text } = await this.postJson(
      url,
      input.accessToken,
      payload,
      "sendDespatch",
    );

    let rawBody: unknown = text;
    try {
      rawBody = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }

    const ticket = extractTicket(rawBody);
    if (!ticket) {
      throw greTransportError("GRE sendDespatch missing numTicket", {
        details: [{ path: "response", issue: text.slice(0, 200) }],
      });
    }

    return { ticket, httpStatus: response.status, rawBody };
  }

  async getStatus(input: GreGetStatusInput): Promise<GreGetStatusResult> {
    assertToken(input.accessToken);
    if (!input.ticket?.trim()) {
      throw greTransportError("ticket is required");
    }

    const url = `${this.apiBase}/v1/contribuyente/gem/comprobantes/envios/${encodeURIComponent(input.ticket)}`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (cause) {
      const aborted =
        cause instanceof Error &&
        (cause.name === "AbortError" || cause.message.includes("abort"));
      throw greTransportError(
        aborted ? "GRE getStatus timed out" : "GRE getStatus network error",
        { cause },
      );
    }

    const text = await response.text();
    if (!response.ok) {
      throw greTransportError(`GRE getStatus HTTP ${response.status}`, {
        details: [{ path: "http", issue: text.slice(0, 200) }],
      });
    }

    let rawBody: unknown = text;
    try {
      rawBody = JSON.parse(text) as unknown;
    } catch {
      /* keep */
    }

    return mapStatusResponse(rawBody, response.status);
  }

  private async postJson(
    url: string,
    accessToken: string,
    payload: unknown,
    operation: string,
  ): Promise<{ response: Response; text: string }> {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (cause) {
      const aborted =
        cause instanceof Error &&
        (cause.name === "AbortError" || cause.message.includes("abort"));
      throw greTransportError(
        aborted
          ? `GRE ${operation} timed out`
          : `GRE ${operation} network error`,
        { cause },
      );
    }

    const text = await response.text();
    if (!response.ok) {
      throw greTransportError(`GRE ${operation} HTTP ${response.status}`, {
        details: [{ path: "http", issue: text.slice(0, 200) }],
      });
    }
    return { response, text };
  }
}

function assertToken(token: string): void {
  if (!token?.trim()) {
    throw greTransportError("accessToken is required");
  }
}

function extractTicket(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const t =
    o.numTicket ??
    o.ticket ??
    (o.archivo as Record<string, unknown> | undefined)?.numTicket;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function mapStatusResponse(
  body: unknown,
  httpStatus: number,
): GreGetStatusResult {
  const o =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  const code = String(
    o.codRespuesta ?? o.codigo ?? o.responseCode ?? o.codEstado ?? "",
  );
  const message = String(
    o.descripcion ?? o.message ?? o.error ?? "",
  ).trim();

  let status: GreTicketStatus = "ticket_pending";
  if (code === "0" || code === "99") {
    status = code === "99" ? "accepted_with_observation" : "accepted";
  } else if (code === "98" || code === "" || code === "1") {
    // 98 = still processing in some GRE responses
    status = code === "98" || code === "1" ? "ticket_pending" : "ticket_pending";
  } else if (code && code !== "0") {
    // numeric error codes → rejected when not pending
    const n = Number(code);
    if (!Number.isNaN(n) && n >= 2000) {
      status = "rejected";
    } else if (code === "98") {
      status = "ticket_pending";
    } else if (o.indEstado === "0" || o.indEstado === 0) {
      status = "accepted";
    } else if (o.indEstado === "98" || o.indEstado === 98) {
      status = "ticket_pending";
    } else if (typeof o.arcCdr === "string" && o.arcCdr) {
      status = "accepted";
    } else if (message.toLowerCase().includes("acept")) {
      status = "accepted";
    } else if (message.toLowerCase().includes("rechaz")) {
      status = "rejected";
    }
  }

  // Prefer explicit indEstado when present
  if (o.indEstado === "0" || o.indEstado === 0) status = "accepted";
  if (o.indEstado === "98" || o.indEstado === 98) status = "ticket_pending";
  if (o.indEstado === "99" || o.indEstado === 99) {
    status = "accepted_with_observation";
  }

  let rawCdrZip: Buffer | undefined;
  const cdrB64 = o.arcCdr ?? o.cdrZip ?? o.applicationResponse;
  if (typeof cdrB64 === "string" && cdrB64.length > 0) {
    try {
      rawCdrZip = Buffer.from(cdrB64, "base64");
    } catch {
      rawCdrZip = undefined;
    }
  }

  return {
    status,
    sunatCode: code || undefined,
    sunatMessage: message || undefined,
    httpStatus,
    rawBody: body,
    rawCdrZip,
  };
}
