import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import { greTransportError } from "./errors";

/** Data issued by SUNAT inside the GRE ApplicationResponse, never synthesized. */
export function parseGreCdr(zipBytes: Buffer) {
  const zip = new AdmZip(zipBytes);
  const entries = zip.getEntries().filter((e) => !e.isDirectory && e.entryName.endsWith(".xml"));
  const entry = entries[0];
  if (entries.length !== 1 || !entry || entry.header.size > 2_000_000)
    throw greTransportError("Invalid GRE CDR ZIP");
  const xml = entry.getData().toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw greTransportError("Unsafe GRE CDR XML");
  const doc = new DOMParser({
    onError: () => {
      throw greTransportError("Malformed GRE CDR XML");
    },
  }).parseFromString(xml, "application/xml");
  const all = (name: string) => Array.from(doc.getElementsByTagNameNS("*", name));
  if (doc.documentElement?.localName !== "ApplicationResponse")
    throw greTransportError("Invalid GRE CDR root");
  const response = all("Response")[0];
  const code = response?.getElementsByTagNameNS("*", "ResponseCode")[0]?.textContent?.trim();
  if (!code) throw greTransportError("GRE CDR missing ResponseCode");
  const message = response?.getElementsByTagNameNS("*", "Description")[0]?.textContent?.trim();
  const notes = all("Note")
    .map((e) => e.textContent?.trim())
    .filter(Boolean);
  const status =
    code === "0" ? (notes.length ? "accepted_with_observation" : "accepted") : "rejected";
  const ref = all("DocumentReference")[0];
  const documentId = ref?.getElementsByTagNameNS("*", "ID")[0]?.textContent?.trim();
  const receiverRuc = all("ReceiverParty")[0]
    ?.getElementsByTagNameNS("*", "ID")[0]
    ?.textContent?.trim();
  const candidates = all("DocumentDescription")
    .map((e) => e.textContent?.trim())
    .filter((v): v is string => !!v);
  const qrUrl = status !== "rejected" ? candidates.find(isOfficialGreQrUrl) : undefined;
  return {
    status,
    sunatCode: code,
    sunatMessage: message,
    notes,
    qrUrl,
    documentId,
    receiverRuc,
  } as const;
}

export function isOfficialGreQrUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      value.length <= 2048 &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "sunat.gob.pe" || url.hostname.endsWith(".sunat.gob.pe"))
    );
  } catch {
    return false;
  }
}
