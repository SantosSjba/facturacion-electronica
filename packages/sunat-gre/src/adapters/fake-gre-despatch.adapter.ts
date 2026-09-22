import AdmZip from "adm-zip";

import type {
  GreDespatchPort,
  GreGetStatusInput,
  GreGetStatusResult,
  GreSendDespatchInput,
  GreSendDespatchResult,
} from "../ports/gre-despatch.port";
import { greTransportError } from "../errors";

/**
 * Offline GreDespatchPort — returns ticket; getStatus → accepted CDR fixture.
 */
export class FakeGreDespatchAdapter implements GreDespatchPort {
  private ticketSeq = 0;
  private readonly tickets = new Map<string, "accepted" | "rejected">();

  async sendDespatch(
    input: GreSendDespatchInput,
  ): Promise<GreSendDespatchResult> {
    if (!input.accessToken?.trim()) {
      throw greTransportError("accessToken is required");
    }
    if (!input.zipBytes?.length) {
      throw greTransportError("zipBytes is empty");
    }
    if (!input.fileName?.trim()) {
      throw greTransportError("fileName is required");
    }

    this.ticketSeq += 1;
    const ticket = `fake-gre-ticket-${this.ticketSeq}`;
    const rejected = input.fileName.toUpperCase().includes("REJECT");
    this.tickets.set(ticket, rejected ? "rejected" : "accepted");
    return { ticket, httpStatus: 200, rawBody: { numTicket: ticket } };
  }

  async getStatus(input: GreGetStatusInput): Promise<GreGetStatusResult> {
    if (!input.accessToken?.trim()) {
      throw greTransportError("accessToken is required");
    }
    if (!input.ticket?.trim()) {
      throw greTransportError("ticket is required");
    }

    const kind =
      this.tickets.get(input.ticket) ??
      (input.ticket.toUpperCase().includes("REJECT") ? "rejected" : "accepted");

    if (kind === "rejected") {
      return {
        status: "rejected",
        sunatCode: "2324",
        sunatMessage: "Fake GRE rejected",
        httpStatus: 200,
        rawCdrZip: buildMinimalCdrZip("2324", "Fake GRE rejected"),
      };
    }

    return {
      status: "accepted",
      sunatCode: "0",
      sunatMessage: "Fake GRE accepted",
      httpStatus: 200,
      rawCdrZip: buildMinimalCdrZip("0", "Fake GRE accepted"),
    };
  }
}

function buildMinimalCdrZip(code: string, message: string): Buffer {
  const xml = `<?xml version="1.0"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ResponseCode>${code}</cbc:ResponseCode>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ResponseCode>${code}</cbc:ResponseCode>
      <cbc:Description>${message}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ApplicationResponse>`;
  const zip = new AdmZip();
  zip.addFile("R-CDR.xml", Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}
