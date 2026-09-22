import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INVOICE_XSD_RELATIVE,
  PACKAGE_NAME,
  SUNAT_VALIDATION_PORT,
  XmllintXsdValidationAdapter,
  type SunatValidationPort,
} from "./index";

const GOLDEN = join(
  process.cwd(),
  "../sunat-ubl/testdata/golden/01-invoice-gravada.unsigned.xml",
);

describe("@factosys/sunat-validation", () => {
  it("exports package name and DI token", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-validation");
    expect(SUNAT_VALIDATION_PORT.description).toBe("SunatValidationPort");
    expect(INVOICE_XSD_RELATIVE).toContain("UBL-Invoice-2.1.xsd");
  });

  it("XmllintXsdValidationAdapter implements SunatValidationPort", () => {
    const adapter: SunatValidationPort = new XmllintXsdValidationAdapter();
    expect(typeof adapter.validateXml).toBe("function");
  });
});

describe("XSD gate (S1-GATE / FE-83)", () => {
  const port = new XmllintXsdValidationAdapter();

  it("accepts golden unsigned Invoice (01)", async () => {
    const xml = readFileSync(GOLDEN, "utf8");
    const result = await port.validateXml({
      documentType: "01",
      xml,
      stages: ["xsd"],
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.rulesetVersion).toMatch(/^xsd-ubl-[a-f0-9]{12}$/);
  });

  it("rejects Invoice missing cbc:ID", async () => {
    const xml = readFileSync(GOLDEN, "utf8").replace(
      /<cbc:ID>F001-00000001<\/cbc:ID>\s*/,
      "",
    );
    expect(xml).not.toContain("F001-00000001");
    const result = await port.validateXml({
      documentType: "01",
      xml,
      stages: ["xsd"],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((i) => i.severity === "error")).toBe(true);
    expect(result.issues.every((i) => i.stage === "xsd")).toBe(true);
  });
});
