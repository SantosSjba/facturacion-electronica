import { describe, expect, it } from "vitest";

import {
  CATALOG_PORT,
  JsonCatalogAdapter,
  PACKAGE_NAME,
  type CatalogPort,
} from "./index";

describe("@factosys/sunat-catalogs", () => {
  it("exports package name and DI token", () => {
    expect(PACKAGE_NAME).toBe("@factosys/sunat-catalogs");
    expect(CATALOG_PORT.description).toBe("CatalogPort");
  });

  it("JsonCatalogAdapter implements CatalogPort", () => {
    const port: CatalogPort = new JsonCatalogAdapter();
    expect(port.rulesetVersion()).toBe("2026-08-26");
    expect(port.listCatalogIds()).toContain("01");
    expect(port.listCatalogIds()).toContain("02");
  });

  it("looks up document type 01 = Factura", async () => {
    const port = new JsonCatalogAdapter();
    const item = await port.getItem("01", "01");
    expect(item).not.toBeNull();
    expect(item?.description.toLowerCase()).toContain("factura");
    expect(await port.hasCode("01", "01")).toBe(true);
    expect(await port.getItem("01", "ZZ")).toBeNull();
  });

  it("looks up currency PEN", async () => {
    const port = new JsonCatalogAdapter();
    expect(await port.hasCode("02", "PEN")).toBe(true);
  });
});
