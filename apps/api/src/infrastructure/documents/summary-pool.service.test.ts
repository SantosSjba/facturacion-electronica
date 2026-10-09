import { describe, expect, it, vi } from "vitest";
import { hydrateFromFixtureRequest, XmlSummaryDocumentsBuilder } from "@factosys/sunat-ubl";
import { phase1Scenarios } from "../../../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import { SummaryPoolService } from "./summary-pool.service";
import type { DocumentsService } from "./documents.service";

describe("phase 0 RC classification", () => {
  it("preserves exempt/unaffected/free bases instead of treating every line as taxable", async () => {
    const rows = [
      {
        id: "receipt",
        documentType: "03",
        currency: "PEN",
        totals: {
          line_extension_amount: 300,
          tax_amount: 36,
          taxed_amount: 100,
          exempt_amount: 100,
          unaffected_amount: 100,
          free_amount: 100,
          free_tax_amount: 18,
          payable_amount: 318,
        },
      },
    ];
    const documents = {
      listPendingSummaryPool: vi.fn().mockResolvedValue(rows),
    } as unknown as DocumentsService;
    const result = await new SummaryPoolService(documents).resolvePool({
      organizationId: "org",
      companyId: "company",
      referenceDate: "2026-10-08",
    });
    expect(result[0]?.totals).toMatchObject({
      gravadas: 100,
      exoneradas: 100,
      inafectas: 100,
      gratuitas: 100,
      igv: 18,
      payable: 318,
    });
  });

  it.each([
    { currency: "USD", totals: {} },
    { currency: "PEN", totals: { export_amount: 100 } },
  ])("rejects unsupported RC data without silently changing its category/currency", async (row) => {
    const documents = {
      listPendingSummaryPool: vi
        .fn()
        .mockResolvedValue([{ id: "receipt", documentType: "03", ...row }]),
    } as unknown as DocumentsService;
    await expect(
      new SummaryPoolService(documents).resolvePool({
        organizationId: "org",
        companyId: "company",
        referenceDate: "2026-10-08",
      }),
    ).rejects.toMatchObject({ httpStatus: 422 });
  });
});

describe("commercial daily summaries", () => {
  it("preserves ISC, IVAP and ICBPER, and puts references/charges before taxes", async () => {
    const requests = phase1Scenarios().filter(
      (r) => r.currency === "PEN" && !r.adjustments?.some((a) => a.code === "03"),
    );
    const rows = requests.map((r, index) => {
      const c = hydrateFromFixtureRequest(r);
      return {
        id: String(index),
        documentType: "03",
        currency: "PEN",
        serieNumber: `B001-${index + 1}`,
        totals: c.totals,
        payload: { _canonical: c },
      };
    });
    const documents = {
      listPendingSummaryPool: vi.fn().mockResolvedValue(rows),
    } as unknown as DocumentsService;
    const pool = await new SummaryPoolService(documents).resolvePool({
      organizationId: "org",
      companyId: "company",
      referenceDate: "2026-10-08",
    });
    for (const line of pool) {
      expect(
        line.totals.gravadas +
          line.totals.exoneradas +
          line.totals.inafectas +
          line.totals.igv +
          (line.totals.ivap ?? 0) +
          (line.totals.isc ?? 0) +
          (line.totals.icbper ?? 0) +
          (line.totals.other_charges ?? 0),
      ).toBeCloseTo(line.totals.payable, 2);
    }
    const xml = new XmlSummaryDocumentsBuilder().build({
      id: "RC-20261008-1",
      issue_date: "2026-10-08",
      reference_date: "2026-10-08",
      supplier: { identity_type: "6", identity_number: "20601234567", name: "Prueba" },
      lines: pool.map((l, index) => ({
        line_id: index + 1,
        document_type: l.documentType,
        serie_number: l.serieNumber,
        status: l.status,
        customer: l.customer,
        totals: l.totals,
      })),
    }).xml;
    expect(xml).toContain("1016");
    expect(xml).toContain("2000");
    expect(xml).toContain("7152");
    const noteXml = new XmlSummaryDocumentsBuilder().build({
      id: "RC-20261008-1",
      issue_date: "2026-10-08",
      reference_date: "2026-10-08",
      supplier: { identity_type: "6", identity_number: "20601234567", name: "Prueba" },
      lines: [
        {
          line_id: 1,
          document_type: "07",
          serie_number: "BC01-1",
          status: "1",
          customer: { identity_type: "1", identity_number: "12345678" },
          totals: {
            gravadas: 100,
            exoneradas: 0,
            inafectas: 0,
            igv: 10.5,
            other_charges: 2,
            payable: 112.5,
            tax_groups: [
              { scheme_id: "1000", name: "IGV", type_code: "VAT", percent: 10.5, amount: 10.5 },
            ],
          },
          affected_document: { document_type: "03", serie_number: "B001-1" },
        },
      ],
    }).xml;
    expect(noteXml.indexOf("<cac:BillingReference>")).toBeLessThan(noteXml.indexOf("<cac:Status>"));
    expect(noteXml.indexOf("<cac:AllowanceCharge>")).toBeLessThan(
      noteXml.indexOf("<cac:TaxTotal>"),
    );
    expect(noteXml).toContain("<cbc:Percent>10.5</cbc:Percent>");
  });
});
