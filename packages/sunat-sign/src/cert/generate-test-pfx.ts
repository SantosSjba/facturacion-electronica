import forge from "node-forge";

/**
 * Ephemeral self-signed PKCS#12 for unit tests and `pnpm spike:sign` when no
 * real cert is configured. Never commit generated PFX bytes to git.
 */
export function generateTestPfx(password: string): {
  pfx: Buffer;
  subjectCn: string;
} {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs: forge.pki.CertificateField[] = [
    { name: "commonName", value: "Factosys Spike Test" },
    { name: "organizationName", value: "Factosys" },
    { name: "countryName", value: "PE" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des",
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();

  return {
    pfx: Buffer.from(der, "binary"),
    subjectCn: "Factosys Spike Test",
  };
}
