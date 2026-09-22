import forge from "node-forge";

import { signError } from "../errors";

export interface LoadedPfx {
  /** PEM-encoded private key (PKCS#8 / RSA). */
  privateKeyPem: string;
  /** PEM-encoded leaf X.509 certificate. */
  certificatePem: string;
  /** Subject DN string safe for redacted logs (no key material). */
  subject: string;
  /** Leaf cert notBefore (ISO). */
  notBefore: string;
  /** Leaf cert notAfter (ISO). */
  notAfter: string;
  /** Common Name if present. */
  subjectCn: string | null;
}

/**
 * Load a PKCS#12 (.pfx / .p12) buffer and extract signing material.
 * Never logs password, PEM, or key bytes.
 */
export function loadPfx(certificate: Buffer, password: string): LoadedPfx {
  if (!Buffer.isBuffer(certificate) || certificate.length === 0) {
    throw signError("PFX certificate buffer is empty or invalid");
  }
  if (typeof password !== "string") {
    throw signError("PFX password must be a string");
  }

  const pkcs8Oid = forge.pki.oids.pkcs8ShroudedKeyBag;
  const keyBagOid = forge.pki.oids.keyBag;
  const certBagOid = forge.pki.oids.certBag;
  if (!pkcs8Oid || !certBagOid) {
    throw signInternalMissingOids();
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const der = forge.util.createBuffer(certificate.toString("binary"));
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (cause) {
    throw signError("Unable to open PFX (wrong password or corrupt file)", {
      cause,
    });
  }

  const shrouded = p12.getBags({ bagType: pkcs8Oid })[pkcs8Oid];
  const plainKeys = keyBagOid
    ? p12.getBags({ bagType: keyBagOid })[keyBagOid]
    : undefined;
  const keyBags = shrouded ?? plainKeys;
  const certBags = p12.getBags({ bagType: certBagOid })[certBagOid];

  const keyBag = keyBags?.[0];
  const certBag = certBags?.[0];
  const privateKey = keyBag?.key;
  const cert = certBag?.cert;

  if (!privateKey || !cert) {
    throw signError("PFX does not contain a private key and X.509 certificate");
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
    subject: formatSubject(cert),
    notBefore: cert.validity.notBefore.toISOString(),
    notAfter: cert.validity.notAfter.toISOString(),
    subjectCn: subjectCn(cert),
  };
}

function subjectCn(cert: forge.pki.Certificate): string | null {
  const cn = cert.subject.getField("CN");
  return cn?.value != null ? String(cn.value) : null;
}

/** Subject attributes only — safe for logs / meta.json. */
export function formatSubject(cert: forge.pki.Certificate): string {
  return cert.subject.attributes
    .map((attr) => {
      const name = attr.shortName ?? attr.name ?? "ATTR";
      return `${name}=${String(attr.value)}`;
    })
    .join(", ");
}

function signInternalMissingOids(): never {
  throw signError("node-forge PKCS#12 OIDs unavailable in this runtime");
}
