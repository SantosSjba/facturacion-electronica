import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { XmlCryptoSignAdapter } from "./adapters/xml-crypto-sign.adapter";
import { verifySignedXml } from "./adapters/verify-signed-xml";
import { generateTestPfx } from "./cert/generate-test-pfx";
import { loadPfx } from "./cert/load-pfx";
import {
  PACKAGE_NAME,
  SIGN_XML_PORT,
  type SignXmlPort,
} from "./index";

const fixtureXml = readFileSync(
  join(process.cwd(), "testdata/minimal-invoice.unsigned.xml"),
  "utf8",
);

describe("@factosys/sunat-sign port contract", () => {
  it("exports package name and DI token", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-sign");
    expect(typeof SIGN_XML_PORT).toBe("symbol");
    expect(SIGN_XML_PORT.description).toBe("SignXmlPort");
  });

  it("XmlCryptoSignAdapter implements SignXmlPort", () => {
    const adapter: SignXmlPort = new XmlCryptoSignAdapter();
    expect(typeof adapter.sign).toBe("function");
  });
});

describe("A1 loadPfx", () => {
  it("loads ephemeral PFX and exposes redacted subject", () => {
    const password = "spike-test-password";
    const { pfx, subjectCn } = generateTestPfx(password);
    const loaded = loadPfx(pfx, password);

    expect(loaded.subject).toContain(subjectCn);
    expect(loaded.privateKeyPem).toContain("PRIVATE KEY");
    expect(loaded.certificatePem).toContain("CERTIFICATE");
  });

  it("rejects wrong password without leaking secrets", () => {
    const { pfx } = generateTestPfx("correct");
    expect(() => loadPfx(pfx, "wrong")).toThrow(/Unable to open PFX/);
  });
});

describe("A2+A3 sign and verify", () => {
  it("signs minimal Invoice and verifies in-process", async () => {
    const password = "spike-test-password";
    const { pfx } = generateTestPfx(password);
    const loaded = loadPfx(pfx, password);
    const adapter = new XmlCryptoSignAdapter();

    const result = await adapter.sign({
      xml: fixtureXml,
      certificate: pfx,
      password,
    });

    expect(result.signedXml).toMatch(/Signature/);
    expect(result.digestValue).toBeTruthy();
    expect(result.signatureValue).toBeTruthy();
    expect(verifySignedXml(result.signedXml, loaded.certificatePem)).toBe(true);
  }, 60_000);

  it("fails verify when signed XML is tampered", async () => {
    const password = "spike-test-password";
    const { pfx } = generateTestPfx(password);
    const loaded = loadPfx(pfx, password);
    const adapter = new XmlCryptoSignAdapter();

    const result = await adapter.sign({
      xml: fixtureXml,
      certificate: pfx,
      password,
    });

    const tampered = result.signedXml.replace("Producto spike", "Producto HACK");
    expect(verifySignedXml(tampered, loaded.certificatePem)).toBe(false);
  }, 60_000);
});
