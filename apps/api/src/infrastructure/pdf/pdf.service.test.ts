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

afterEach(() => vi.restoreAllMocks());

function fixture(withLogo = true) {
  const documents = {
    getById: vi
      .fn()
      .mockResolvedValue({
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
    requireCompany: vi
      .fn()
      .mockResolvedValue({
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
