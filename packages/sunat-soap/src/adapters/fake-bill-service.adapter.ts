import { soapTransportError } from "../errors";
import { buildCdrZipFixture, type CdrFixtureKind } from "../cdr/build-cdr-fixture";
import { parseCdrZip } from "../cdr/parse-cdr-zip";
import type { BillServicePort } from "../ports/bill-service.port";
import type {
  GetStatusInput,
  GetStatusResult,
  SendBillInput,
  SendBillResult,
  SendSummaryInput,
  SendSummaryResult,
} from "../ports/bill-service.types";

export type FakeBillMode = CdrFixtureKind;

export interface FakeBillServiceOptions {
  /** Default CDR outcome. Overridden when `fileName` contains `REJECT` or `OBS`. */
  mode?: FakeBillMode;
}

/**
 * Offline BillServicePort for CI / Fake mode.
 * SendSummary returns a deterministic ticket; getStatus returns a CDR ZIP.
 */
export class FakeBillServiceAdapter implements BillServicePort {
  private readonly defaultMode: FakeBillMode;
  private readonly tickets = new Map<string, FakeBillMode>();
  private ticketSeq = 0;

  constructor(options: FakeBillServiceOptions = {}) {
    this.defaultMode = options.mode ?? "accepted";
  }

  async sendBill(input: SendBillInput): Promise<SendBillResult> {
    if (!input?.zipBytes?.length) {
      throw soapTransportError("zipBytes is empty");
    }
    if (!input.fileName?.trim()) {
      throw soapTransportError("fileName is required");
    }

    const kind = resolveMode(input.fileName, this.defaultMode);
    const rawCdrZip = buildCdrZipFixture(kind);
    const parsed = parseCdrZip(rawCdrZip);

    return {
      rawCdrZip,
      statusCode: parsed.sunatCode,
      statusMessage: parsed.sunatMessage,
    };
  }

  async sendSummary(input: SendSummaryInput): Promise<SendSummaryResult> {
    if (!input?.zipBytes?.length) {
      throw soapTransportError("zipBytes is empty");
    }
    if (!input.fileName?.trim()) {
      throw soapTransportError("fileName is required");
    }

    this.ticketSeq += 1;
    const ticket = `fake-ticket-${this.ticketSeq}-${Date.now()}`;
    const kind = resolveMode(input.fileName, this.defaultMode);
    this.tickets.set(ticket, kind);
    return { ticket };
  }

  async getStatus(input: GetStatusInput): Promise<GetStatusResult> {
    if (!input.ticket?.trim()) {
      throw soapTransportError("ticket is required");
    }
    const kind =
      this.tickets.get(input.ticket) ??
      (input.ticket.toUpperCase().includes("REJECT")
        ? "rejected"
        : this.defaultMode);
    const rawCdrZip = buildCdrZipFixture(kind);
    const parsed = parseCdrZip(rawCdrZip);
    return {
      rawCdrZip,
      statusCode: parsed.sunatCode,
      statusMessage: parsed.sunatMessage,
    };
  }
}

function resolveMode(fileName: string, fallback: FakeBillMode): FakeBillMode {
  const upper = fileName.toUpperCase();
  if (upper.includes("REJECT")) return "rejected";
  if (upper.includes("OBS")) return "accepted_with_observation";
  return fallback;
}
