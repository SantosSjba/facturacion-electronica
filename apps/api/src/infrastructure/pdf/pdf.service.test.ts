import { phase1Scenarios } from "../../../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import { ConfigService } from "@nestjs/config";
import { FakePdfRenderer } from "@factosys/pdf-ri";
import { AppError } from "@factosys/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfService } from "./pdf.service";
import type { DocumentsService } from "../documents/documents.service";
import type { CompaniesService } from "../companies/companies.service";
import type { CompanyLogoService } from "../companies/company-logo.service";
import type { QueueProducer } from "../queues/queue.producer";
import { envSchema, type Env } from "../config/env.schema";
import { hydrateFromFixtureRequest, loadGravadaFixtureRequest } from "@factosys/sunat-ubl";

afterEach(() => vi.restoreAllMocks());

function fixture(withLogo = true) {
  const documents = {
    getById: vi.fn().mockResolvedValue({
      companyId: "company",
      documentType: "01",
      serieNumber: "F001-1",
      issueDate: "2026-10-08",
      totals: { total: "100.00" },
    }),
    getArtifact: vi.fn().mockImplementation(async (_org, _doc, kind) => {
      if (kind === "pdf") throw AppError.notFound("Artifact not found");
      return { body: Buffer.from("<DigestValue>abc=</DigestValue>") };
    }),
    putArtifact: vi.fn().mockResolvedValue(undefined),
  };
  const companies = {
    requireCompany: vi.fn().mockResolvedValue({
      ruc: "20100070970",
      legalName: "Demo",
      logo: withLogo ? { objectKey: "org/company/logo.png" } : null,
    }),
  };
  const logos = { getDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,aGVsbG8=") };
  const service = new PdfService(
    documents as unknown as DocumentsService,
    companies as unknown as CompaniesService,
    {} as QueueProducer,
    new ConfigService<Env, true>(envSchema.parse({ NODE_ENV: "test", PDF_RI_MODE: "fake" })),
    logos as unknown as CompanyLogoService,
  );
  return { service, documents, companies, logos };
}

describe("company logo PDF wiring", () => {
  it("uses the persisted fiscal snapshot for all lines, taxes and addresses", async () => {
    const { service, documents } = fixture(false);
    const base = loadGravadaFixtureRequest();
    const canonical = hydrateFromFixtureRequest({
      ...base,
      purchase_order: "OC-1",
      due_date: "2026-10-30",
      legends: [{ code: "1000", text: "TOTAL" }],
      customer: { ...base.customer, address: { line: "Calle Uno" } },
      lines: [
        required(base.lines[0]),
        {
          ...required(base.lines[0]),
          id: 2,
          tax_affectation: "20",
          tax_scheme_id: "9997",
          igv_percent: 0,
          unit_price: 100,
        },
      ],
    });
    const render = vi.spyOn(FakePdfRenderer.prototype, "render");
    documents.getById.mockResolvedValue({
      companyId: "company",
      documentType: "01",
      totals: canonical.totals,
      payload: { _canonical: canonical },
    });
    await service.renderAndStore("org", "document");
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({ unitPrice: "118.00", igv: "18.00", amount: "118.00" }),
          expect.objectContaining({ unitPrice: "100.00", igv: "0.00", amount: "100.00" }),
        ],
        totals: expect.objectContaining({
          gravado: "100.00",
          exempt: "100.00",
          igv: "18.00",
          total: "218.00",
        }),
        customer: expect.objectContaining({ address: "Calle Uno" }),
        purchaseOrder: "OC-1",
        dueDate: "2026-10-30",
      }),
    );
  });

  it("does not include free-operation tax in the collectible total or CPE QR IGV", async () => {
    const { service, documents } = fixture(false);
    const base = loadGravadaFixtureRequest();
    const canonical = hydrateFromFixtureRequest({
      ...base,
      lines: [
        { ...required(base.lines[0]), tax_affectation: "11", tax_scheme_id: "9996", unit_price: 0 },
      ],
    });
    const render = vi.spyOn(FakePdfRenderer.prototype, "render");
    documents.getById.mockResolvedValue({
      companyId: "company",
      documentType: "01",
      totals: canonical.totals,
      payload: { _canonical: canonical },
    });
    await service.renderAndStore("org", "document");
    expect(render.mock.calls[0]?.[0]).toMatchObject({
      totals: { total: "0.00", igv: "0.00", free: "100.00", freeTax: "18.00" },
      lines: [{ amount: "0.00", unitPrice: "0.00" }],
    });
  });
  it("loads the company's image and sends it to the renderer", async () => {
    const render = vi.spyOn(FakePdfRenderer.prototype, "render");
    const { service, logos, documents } = fixture();
    await service.renderAndStore("org", "document");
    expect(logos.getDataUrl).toHaveBeenCalledWith({ objectKey: "org/company/logo.png" });
    expect(render.mock.calls[0]?.[0].issuer.logoDataUrl).toBe("data:image/png;base64,aGVsbG8=");
    expect(documents.putArtifact).toHaveBeenCalledOnce();
  });

  it("continues generating documents when no logo is configured", async () => {
    const { service, logos } = fixture(false);
    expect((await service.renderAndStore("org", "document")).toString()).toContain("%PDF-");
    expect(logos.getDataUrl).not.toHaveBeenCalled();
  });

  it("preserves a stored PDF during background retries after a logo changes", async () => {
    const { service, documents, companies, logos } = fixture();
    const existing = Buffer.from("%PDF-1.4 existing branded PDF");
    documents.getArtifact.mockResolvedValue({ body: existing });
    expect(await service.renderAndStore("org", "document")).toBe(existing);
    expect(companies.requireCompany).not.toHaveBeenCalled();
    expect(logos.getDataUrl).not.toHaveBeenCalled();
    expect(documents.putArtifact).not.toHaveBeenCalled();
  });

  it("uses the logo saved at emission even after replacing or deleting the company logo", async () => {
    const { service, documents, logos } = fixture(false);
    documents.getById.mockResolvedValue({
      companyId: "company",
      documentType: "03",
      serieNumber: "B001-1",
      logoSnapshot: { logo: { objectKey: "previous-logo.png" } },
    });
    await service.renderAndStore("org", "document");
    expect(logos.getDataUrl).toHaveBeenCalledWith({ objectKey: "previous-logo.png" });
  });

  it("keeps emission without a logo unchanged when a logo is added later", async () => {
    const { service, documents, logos } = fixture(true);
    documents.getById.mockResolvedValue({
      companyId: "company",
      documentType: "07",
      serieNumber: "FC01-1",
      logoSnapshot: { logo: null },
    });
    await service.renderAndStore("org", "document");
    expect(logos.getDataUrl).not.toHaveBeenCalled();
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value");
  return value;
}

describe("commercial PDF snapshot", () => {
  it.each(phase1Scenarios().map((request, index) => ({ request, index })))(
    "prints commercial fiscal scenario $index",
    async ({ request, index }) => {
      const { service, documents } = fixture(false);
      const canonical = hydrateFromFixtureRequest(request);
      documents.getById.mockResolvedValue({
        companyId: "company",
        documentType: "01",
        totals: canonical.totals,
        payload: { _canonical: canonical },
      });
      const render = vi.spyOn(FakePdfRenderer.prototype, "render");
      await service.renderAndStore("org", "document");
      const input = render.mock.calls[0]?.[0];
      if (!input) throw new Error("Missing render input");
      expect(input.totals.total).toBe(canonical.totals.payable_amount.toFixed(2));
      expect(input.currency).toBe(request.currency);
      if (index === 1) {
        expect(input.lines[0]?.amount).toBe("108.20");
        expect(input.totals).toMatchObject({
          gravado: "85.00",
          igv: "15.30",
          charges: "5.00",
          total: "105.30",
        });
      }
      if (index === 0) {
        expect(input.commercialSections).toContainEqual({
          title: "Forma de pago",
          entries: [
            { label: "Condición", value: "Crédito" },
            { label: "Saldo pendiente", value: "118.00 PEN" },
            { label: "Cuota 1", value: "2026-11-08 — 50.00 PEN" },
            { label: "Cuota 2", value: "2026-12-08 — 68.00 PEN" },
          ],
        });
      }
      if (request.prepayments?.length)
        expect(input.commercialSections?.some((s) => s.title === "Anticipos")).toBe(true);
      if (request.detraction)
        expect(input.commercialSections?.some((s) => s.title === "Detracción")).toBe(true);
      if (request.exchange_rate)
        expect(input.commercialSections?.some((s) => s.title === "Tipo de cambio")).toBe(true);
      if (request.lines[0]?.cargo_transport)
        expect(input.lines[0]?.details?.join(" ")).toContain("200.00 PEN");
    },
  );
});

describe("phase 2 persisted printing and preview", () => {
  it("uses the emission format even after the company default changes", async () => {
    const { service, documents, companies } = fixture(false);
    const canonical = hydrateFromFixtureRequest(loadGravadaFixtureRequest());
    documents.getById.mockResolvedValue({
      companyId: "company",
      documentType: "01",
      totals: canonical.totals,
      payload: { _canonical: canonical, _print: { format: "TICKET58", template_version: "ri-v2" } },
    });
    companies.requireCompany.mockResolvedValue({
      ruc: "20100070970",
      legalName: "Changed",
      logo: null,
      pdfFormat: "A4",
    });
    const render = vi.spyOn(FakePdfRenderer.prototype, "render");
    await service.renderAndStore("org", "document");
    expect(render.mock.calls[0]?.[0]).toMatchObject({
      format: "TICKET58",
      templateVersion: "ri-v2",
    });
  });
  it("renders preview from canonical totals without document reads, signed XML or artifact writes", async () => {
    const { service, documents } = fixture(false);
    const canonical = hydrateFromFixtureRequest(loadGravadaFixtureRequest());
    const render = vi.spyOn(FakePdfRenderer.prototype, "render");
    await service.renderPreview(
      "org",
      "company",
      canonical as unknown as Record<string, unknown>,
      "A5",
    );
    expect(render.mock.calls[0]?.[0]).toMatchObject({
      preview: true,
      format: "A5",
      digestValue: "",
      qrPayload: "",
    });
    expect(documents.getById).not.toHaveBeenCalled();
    expect(documents.getArtifact).not.toHaveBeenCalled();
    expect(documents.putArtifact).not.toHaveBeenCalled();
  });
  it("exposes fiscal QR data only to the scoped document lookup", async () => {
    const { service, documents } = fixture(false);
    documents.getById.mockRejectedValue(AppError.notFound("Document not found"));
    await expect(service.getQr("other-org", "document")).rejects.toMatchObject({ httpStatus: 404 });
    expect(documents.getArtifact).not.toHaveBeenCalled();
  });
  it("preserves the XML precision of unit prices instead of printing zero for small unit values", async () => {
    const { service, documents } = fixture(false);
    const base = loadGravadaFixtureRequest();
    const first = required(base.lines[0]);
    const canonical = hydrateFromFixtureRequest({
      ...base,
      lines: [{ ...first, quantity: 100000, unit_value: 0.000001, unit_price: undefined }],
    });
    documents.getById.mockResolvedValue({
      companyId: "company",
      documentType: "01",
      payload: { _canonical: canonical },
      totals: canonical.totals,
    });
    const render = vi.spyOn(FakePdfRenderer.prototype, "render");
    await service.renderAndStore("org", "document");
    expect(render.mock.calls[0]?.[0].lines[0]?.unitPrice).toBe("0.00000118");
  });
});
