import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";

import { signError } from "../errors";

/**
 * In-process XMLDSig verify (Spike A3 / A4 equivalent).
 * Returns true when the first `ds:Signature` validates against `publicCertPem`.
 */
export function verifySignedXml(
  signedXml: string,
  publicCertPem: string,
): boolean {
  if (!signedXml?.trim()) {
    throw signError("Signed XML is empty");
  }
  if (!publicCertPem?.trim()) {
    throw signError("Public certificate PEM is empty");
  }

  const doc = new DOMParser().parseFromString(signedXml, "text/xml");
  const signature = findSignatureNode(doc);
  if (!signature) {
    return false;
  }

  const sig = new SignedXml({
    publicCert: publicCertPem,
    getCertFromKeyInfo: () => null,
  });
  sig.loadSignature(signature);
  return sig.checkSignature(signedXml);
}

function findSignatureNode(doc: Document): Element | null {
  const byNs = doc.getElementsByTagNameNS(
    "http://www.w3.org/2000/09/xmldsig#",
    "Signature",
  );
  if (byNs.length > 0) {
    return byNs.item(0);
  }
  const byName = doc.getElementsByTagName("ds:Signature");
  if (byName.length > 0) {
    return byName.item(0);
  }
  const plain = doc.getElementsByTagName("Signature");
  return plain.length > 0 ? plain.item(0) : null;
}
