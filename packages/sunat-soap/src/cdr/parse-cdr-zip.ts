import AdmZip from "adm-zip";
import { DOMParser, type Document, type Element } from "@xmldom/xmldom";

import { soapCdrInternal, soapCdrRejected } from "../errors";

export type CdrStatus = "accepted" | "accepted_with_observation" | "rejected";

export interface ParsedCdr {
  status: CdrStatus;
  /** Zero-padded / as-emitted ResponseCode string (e.g. "0", "98", "2324"). */
  sunatCode: string;
  sunatMessage?: string;
  observations: string[];
  documentId?: string;
  receiverRuc?: string;
}

function findFirstByLocalName(parent: Element | Document, localName: string): Element | null {
  const nodes = parent.getElementsByTagName("*");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes.item(i);
    if (!el) continue;
    if (
      el.localName === localName ||
      el.nodeName === localName ||
      el.nodeName.endsWith(`:${localName}`)
    ) {
      return el;
    }
  }
  return null;
}

function textContent(el: Element | null): string {
  return (el?.textContent ?? "").trim();
}

/**
 * Classify SUNAT CDR ZIP → status + sunatCode (doc 24 §C.2 / 16 simplified).
 *
 * Mapping (spike):
 * - `0` → accepted
 * - `0` plus Note elements → accepted_with_observation
 * - otherwise (incl. ≥2000) → rejected
 */
export function parseCdrZip(rawCdrZip: Buffer): ParsedCdr {
  if (!rawCdrZip?.length) {
    throw soapCdrInternal("CDR ZIP is empty");
  }

  let xml: string;
  try {
    const zip = new AdmZip(rawCdrZip);
    const entries = zip
      .getEntries()
      .filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".xml"));
    const xmlEntry = entries[0];
    if (entries.length !== 1 || !xmlEntry || xmlEntry.header.size > 2_000_000) {
      throw soapCdrInternal("CDR ZIP has no entries");
    }
    xml = xmlEntry.getData().toString("utf8");
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause) {
      throw cause;
    }
    throw soapCdrInternal("Failed to unzip CDR", { cause });
  }

  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw soapCdrInternal("Unsafe CDR XML");
  const doc = new DOMParser({
    onError: () => {
      throw soapCdrInternal("Malformed CDR XML");
    },
  }).parseFromString(xml, "text/xml");
  if (doc.documentElement?.localName !== "ApplicationResponse")
    throw soapCdrInternal("Invalid CDR root");
  const responseCodeEl = findFirstByLocalName(doc, "ResponseCode");
  const descriptionEl = findFirstByLocalName(doc, "Description");

  if (!responseCodeEl) {
    throw soapCdrInternal("ApplicationResponse missing cbc:ResponseCode");
  }

  const sunatCode = textContent(responseCodeEl);
  const sunatMessage = textContent(descriptionEl) || undefined;

  const observations = Array.from(doc.getElementsByTagNameNS("*", "Note"))
    .map((n) => n.textContent?.trim() ?? "")
    .filter(Boolean);
  let status: CdrStatus;
  if (sunatCode === "0") {
    status = observations.length ? "accepted_with_observation" : "accepted";
  } else {
    status = "rejected";
  }

  const reference = findFirstByLocalName(doc, "DocumentReference");
  const receiver = findFirstByLocalName(doc, "ReceiverParty");
  return {
    status,
    sunatCode,
    sunatMessage,
    observations,
    documentId: reference ? textContent(findFirstByLocalName(reference, "ID")) : undefined,
    receiverRuc: receiver ? textContent(findFirstByLocalName(receiver, "ID")) : undefined,
  };
}

/** Throw {@link soapCdrRejected} when status is rejected. */
export function assertCdrAccepted(parsed: ParsedCdr): void {
  if (parsed.status === "rejected") {
    throw soapCdrRejected(
      parsed.sunatMessage ?? `SUNAT rejected document (code ${parsed.sunatCode})`,
      {
        sunatCode: parsed.sunatCode,
        sunatMessage: parsed.sunatMessage,
      },
    );
  }
}
