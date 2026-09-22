import { DOMParser, XMLSerializer, type Document, type Element } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";

import { loadPfx } from "../cert/load-pfx";
import { signError, signInternal } from "../errors";
import type { SignXmlPort } from "../ports/sign-xml.port";
import type { SignXmlInput, SignXmlResult } from "../ports/sign-xml.types";

const NS = {
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
} as const;

const C14N_EXC = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256";
const RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

/**
 * Spike A adapter: xml-crypto + Exclusive C14N + RSA-SHA256.
 * Inserts `ds:Signature` into the first `ext:ExtensionContent`.
 */
export class XmlCryptoSignAdapter implements SignXmlPort {
  async sign(input: SignXmlInput): Promise<SignXmlResult> {
    if (!input?.xml?.trim()) {
      throw signError("XML to sign is empty");
    }

    const loaded = loadPfx(input.certificate, input.password);
    const preparedXml = ensureUblExtensionContent(input.xml);

    try {
      const sig = new SignedXml({
        privateKey: loaded.privateKeyPem,
        publicCert: loaded.certificatePem,
        canonicalizationAlgorithm: C14N_EXC,
        signatureAlgorithm: RSA_SHA256,
      });

      sig.addReference({
        xpath: "/*",
        transforms: [ENVELOPED, C14N_EXC],
        digestAlgorithm: SHA256,
        uri: "",
        isEmptyUri: true,
      });

      sig.computeSignature(preparedXml, {
        prefix: "ds",
        location: {
          reference: "//*[local-name(.)='ExtensionContent']",
          action: "append",
        },
        existingPrefixes: {
          ext: NS.ext,
          cac: NS.cac,
          cbc: NS.cbc,
          ds: NS.ds,
        },
      });

      const signedXml = sig.getSignedXml();
      const { digestValue, signatureValue } = extractSignatureValues(signedXml);

      return { signedXml, digestValue, signatureValue };
    } catch (cause) {
      if (cause && typeof cause === "object" && "stage" in cause) {
        throw cause;
      }
      throw signInternal("XML signature computation failed", { cause });
    }
  }
}

/**
 * Ensure document has `ext:UBLExtensions` → `ext:UBLExtension` → `ext:ExtensionContent`
 * so the signature has a SUNAT-compatible insertion point.
 */
export function ensureUblExtensionContent(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  if (!root) {
    throw signError("XML document has no root element");
  }

  let extensions = findFirstByLocalName(root, "UBLExtensions");
  if (!extensions) {
    extensions = doc.createElementNS(NS.ext, "ext:UBLExtensions");
    root.insertBefore(extensions, root.firstChild);
  }

  let extension = findFirstByLocalName(extensions, "UBLExtension");
  if (!extension) {
    extension = doc.createElementNS(NS.ext, "ext:UBLExtension");
    extensions.appendChild(extension);
  }

  let content = findFirstByLocalName(extension, "ExtensionContent");
  if (!content) {
    content = doc.createElementNS(NS.ext, "ext:ExtensionContent");
    extension.appendChild(content);
  }

  return new XMLSerializer().serializeToString(doc);
}

function findFirstByLocalName(parent: Element, localName: string): Element | null {
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);
    if (node && node.nodeType === 1) {
      const el = node as Element;
      if (
        el.localName === localName ||
        el.nodeName === localName ||
        el.nodeName.endsWith(`:${localName}`)
      ) {
        return el;
      }
    }
  }

  const byNs = parent.getElementsByTagNameNS(NS.ext, localName);
  if (byNs.length > 0) {
    return byNs.item(0);
  }
  const fallback = parent.getElementsByTagName(localName);
  if (fallback.length > 0) {
    return fallback.item(0);
  }
  const prefixed = parent.getElementsByTagName(`ext:${localName}`);
  if (prefixed.length > 0) {
    return prefixed.item(0);
  }
  return null;
}

function extractSignatureValues(signedXml: string): {
  digestValue?: string;
  signatureValue?: string;
} {
  const doc = new DOMParser().parseFromString(signedXml, "text/xml");
  const digest =
    textOfFirst(doc, "DigestValue") ?? textOfFirst(doc, "ds:DigestValue");
  const signature =
    textOfFirst(doc, "SignatureValue") ?? textOfFirst(doc, "ds:SignatureValue");
  return {
    digestValue: digest?.trim() || undefined,
    signatureValue: signature?.trim() || undefined,
  };
}

function textOfFirst(doc: Document, tag: string): string | null {
  const nodes = doc.getElementsByTagName(tag);
  const node = nodes.item(0);
  return node?.textContent ?? null;
}
