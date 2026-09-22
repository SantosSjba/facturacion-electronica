import { soapTransportError } from "../errors";
import { buildCdrZipFixture, type CdrFixtureKind } from "../cdr/build-cdr-fixture";
import { parseCdrZip } from "../cdr/parse-cdr-zip";
import type { BillServicePort } from "../ports/bill-service.port";
import type {
  SendBillInput,
  SendBillResult,
} from "../ports/bill-service.types";

export type FakeBillMode = CdrFixtureKind;

export interface FakeBillServiceOptions {
  /** Default CDR outcome. Overridden when `fileName` contains `REJECT` or `OBS`. */
  mode?: FakeBillMode;
}

/**
 * Offline BillServicePort for Spike C / CI (doc 24 §C.4).
 * No network. Returns a real CDR ZIP (ApplicationResponse inside).
 */
export class FakeBillServiceAdapter implements BillServicePort {
  private readonly defaultMode: FakeBillMode;

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
}

function resolveMode(fileName: string, fallback: FakeBillMode): FakeBillMode {
  const upper = fileName.toUpperCase();
  if (upper.includes("REJECT")) return "rejected";
  if (upper.includes("OBS")) return "accepted_with_observation";
  return fallback;
}
