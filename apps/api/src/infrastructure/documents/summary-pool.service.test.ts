import { describe, expect, it, vi } from "vitest";
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
    expect(result[0]?.totals).toEqual({
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
