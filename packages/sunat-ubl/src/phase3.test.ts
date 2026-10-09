import { describe, expect, it } from "vitest";
import { greScenario } from "../test-fixtures/gre-scenarios";
import { XmlDespatchAdviceBuilder, assertDespatchCanonical } from "./index";

describe("phase 3 GRE fiscal contract", () => {
  it("requires valid related-document combinations for carrier GRE and normalized product details", () => {
    const c = greScenario("carrier");
    c.related_documents = [
      { document_type: "01", serie_number: "F001-1", issuer: c.supplier },
      { document_type: "50", serie_number: "118-2026-10-12345" },
    ];
    expect(() => assertDespatchCanonical(c)).toThrow();
    const p = greScenario();
    const line = p.lines[0];
    if (!line) throw new Error("Missing fixture line");
    line.normalized_good = true;
    expect(() => assertDespatchCanonical(p)).toThrow();
  });
  it("preserves distinct handover and start dates plus quantity precision", () => {
    const { xml } = new XmlDespatchAdviceBuilder().build(greScenario());
    expect(xml).toContain("2026-10-09</cbc:OccurrenceDate>");
    expect(xml).toContain("2026-10-10</cbc:StartDate>");
    expect(xml).toContain("08:00:00</cbc:StartTime>");
    expect(xml).toContain(">12.123456789</cbc:DeliveredQuantity>");
    expect(xml).toContain('listID="20601234567"');
  });
  it("nests secondary equipment under the primary and assigns driver roles", () => {
    const { xml } = new XmlDespatchAdviceBuilder().build(greScenario("private"));
    expect(xml).toContain("AttachedTransportEquipment");
    expect(xml).toContain("987654321</cbc:RegistrationNationalityID>");
    expect(xml).toContain("Principal</cbc:JobTitle>");
    expect(xml).toContain("Secundario</cbc:JobTitle>");
    expect(xml).toContain("Lopez</cbc:FamilyName>");
    expect(xml).toContain('schemeID="01" schemeName="Entidad Autorizadora"');
  });
  it("maps subcontractor, payer and customs information without tax totals", () => {
    const { xml } = new XmlDespatchAdviceBuilder().build(greScenario("carrier"));
    expect(xml).toContain("SUNAT_Envio_IndicadorTrasporteSubcontratado");
    expect(xml).toContain("SUNAT_Envio_IndicadorPagadorFlete_Tercero");
    expect(xml).toContain("LogisticsOperatorParty");
    expect(xml).toContain("OriginatorCustomerParty");
    expect(xml).toContain("7020</cbc:NameCode>");
    expect(xml).not.toContain("TaxTotal");
  });
  it("maps DAM/item references, container seals and port", () => {
    const { xml } = new XmlDespatchAdviceBuilder().build(greScenario("export"));
    for (const value of [
      "7021</cbc:NameCode>",
      "7023</cbc:NameCode>",
      "118-2026-10-12345",
      "PRECINTO123</cbc:TraceID>",
      "FirstArrivalPortLocation",
    ])
      expect(xml).toContain(value);
  });
  it.each(["handover_date", "carrier"] as const)("requires public transport %s", (key) => {
    const c = greScenario();
    if (key === "handover_date") delete c.shipment.handover_date;
    else delete c.shipment.carrier;
    expect(() => assertDespatchCanonical(c)).toThrow();
  });
  it("rejects contradictory indicators, missing payer and misassigned roles", () => {
    const c = greScenario("carrier");
    delete c.shipment.freight_payer;
    expect(() => assertDespatchCanonical(c)).toThrow();
    const p = greScenario("private");
    const driver = p.shipment.drivers?.[0];
    if (!driver) throw new Error("Missing fixture driver");
    driver.job_title = "Secundario";
    expect(() => assertDespatchCanonical(p)).toThrow();
    const r = greScenario();
    r.shipment.return_empty_vehicle = r.shipment.return_empty_packaging = true;
    expect(() => assertDespatchCanonical(r)).toThrow();
  });
  it("rejects unknown/partial fields and invalid customs references, dates or fractional packages", () => {
    for (const patch of [
      { total_packages: 1.5 },
      { start_date: "2026-02-30" },
      { gross_weight_unit: "NIU" },
      { carrier: { name: "Incomplete" } },
      { invented_indicator: true },
    ])
      expect(() =>
        assertDespatchCanonical({
          ...greScenario(),
          shipment: { ...greScenario().shipment, ...patch },
        }),
      ).toThrow();
    const c = greScenario("export");
    const line = c.lines[0];
    if (!line) throw new Error("Missing fixture line");
    line.customs_document_number = "118-2026-10-54321";
    expect(() => assertDespatchCanonical(c)).toThrow();
  });
});
