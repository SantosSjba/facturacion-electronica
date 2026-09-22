import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CompositeSunatValidationAdapter,
  ExcelP0ValidationAdapter,
  INVOICE_XSD_RELATIVE,
  PACKAGE_NAME,
  P0_SUNAT_CODES,
  SUNAT_VALIDATION_PORT,
  XmllintXsdValidationAdapter,
  isObsMigratedToError,
  loadObsToErrorCodes,
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

  it("adapters implement SunatValidationPort", () => {
    const xsd: SunatValidationPort = new XmllintXsdValidationAdapter();
    const excel: SunatValidationPort = new ExcelP0ValidationAdapter();
    const composite: SunatValidationPort = new CompositeSunatValidationAdapter();
    expect(typeof xsd.validateXml).toBe("function");
    expect(typeof excel.validateXml).toBe("function");
    expect(typeof composite.validateXml).toBe("function");
  });

  it("loads OBS→ERROR codes", () => {
    const set = loadObsToErrorCodes();
    expect(set.size).toBeGreaterThan(10);
    expect(isObsMigratedToError("4287") || isObsMigratedToError("3270")).toBe(
      true,
    );
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

describe("Excel P0 gate (S2-VAL / FE-103)", () => {
  const excel = new ExcelP0ValidationAdapter();
  const composite = new CompositeSunatValidationAdapter();

  it("accepts golden on excel stage", async () => {
    const xml = readFileSync(GOLDEN, "utf8");
    const result = await excel.validateXml({
      documentType: "01",
      xml,
      stages: ["excel"],
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.rulesetVersion).toBe("2026-08-26");
  });

  it("rejects invalid currency with sunatCode", async () => {
    const xml = readFileSync(GOLDEN, "utf8").replace(
      ">PEN</cbc:DocumentCurrencyCode>",
      ">ZZZ</cbc:DocumentCurrencyCode>",
    );
    const result = await excel.validateXml({
      documentType: "01",
      xml,
      stages: ["excel"],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.sunatCode === P0_SUNAT_CODES.moneda)).toBe(
      true,
    );
  });

  it("rejects broken totals", async () => {
    const xml = readFileSync(GOLDEN, "utf8").replace(
      /<cbc:PayableAmount currencyID="PEN">118\.00<\/cbc:PayableAmount>/,
      '<cbc:PayableAmount currencyID="PEN">999.00</cbc:PayableAmount>',
    );
    const result = await excel.validateXml({
      documentType: "01",
      xml,
      stages: ["excel"],
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.sunatCode === P0_SUNAT_CODES.totales),
    ).toBe(true);
  });

  it("composite xsd+excel accepts golden", async () => {
    const xml = readFileSync(GOLDEN, "utf8");
    const result = await composite.validateXml({
      documentType: "01",
      xml,
      stages: ["xsd", "excel"],
    });
    expect(result.ok).toBe(true);
  });
});
