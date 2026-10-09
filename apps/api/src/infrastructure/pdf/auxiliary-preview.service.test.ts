import { afterEach, expect, it, vi } from "vitest";
import type { Db } from "@factosys/db";
import { FakePdfRenderer } from "@factosys/pdf-ri";
import { ConfigService } from "@nestjs/config";
import { greScenario } from "../../../../../packages/sunat-ubl/test-fixtures/gre-scenarios";
import {
  taxAgentRequest,
  AGENT,
} from "../../../../../packages/sunat-ubl/test-fixtures/tax-agent-scenarios";
import { AuxiliaryPreviewService } from "./auxiliary-preview.service";
import { PreviewService } from "./preview.service";
import { PdfService } from "./pdf.service";
import { previewCreateSchema } from "../../interfaces/http/dto/preview-create.schema";
import type { CompaniesService } from "../companies/companies.service";
import type { SummaryPoolService } from "../documents/summary-pool.service";
import type { TaxAgentService } from "../documents/tax-agent.service";
import type { DocumentsService } from "../documents/documents.service";
import type { CompanyLogoService } from "../companies/company-logo.service";
import type { EmitCreditNoteUseCase, EmitDebitNoteUseCase } from "../documents/emit-note.use-case";
import type { QueueProducer } from "../queues/queue.producer";
import { envSchema, type Env } from "../config/env.schema";
const companyId = "00000000-0000-4000-8000-000000000001";
const company = {
  id: companyId,
  ruc: AGENT.identity_number,
  legalName: AGENT.name,
  taxAgentSettings: { retention: true, perception_regimes: ["01", "02", "03"] },
  pdfFormat: "A4",
};
const companies = {
  requireActiveCompany: vi.fn(async () => company),
  requireCompany: vi.fn(async () => company),
} as unknown as CompaniesService;
const pool = {
  resolvePool: vi.fn(async () => [
    {
      documentId: "receipt",
      documentType: "03",
      serieNumber: "B001-1",
      status: "1",
      customer: { identity_type: "1", identity_number: "12345678" },
      totals: { gravadas: 100, exoneradas: 0, inafectas: 0, igv: 18, payable: 118 },
    },
  ]),
} as unknown as SummaryPoolService;
const agents = {
  previewReversion: vi.fn(async () => ({
    id: "RR-20261009-1",
    issue_date: "2026-10-09",
    reference_date: "2026-10-08",
    supplier: AGENT,
    lines: [{ line_id: 1, document_type: "20", serie: "R001", number: 1, reason: "Error" }],
  })),
} as unknown as TaxAgentService;
const auxiliary = new AuxiliaryPreviewService(companies, pool, agents);
const docs = { getArtifact: vi.fn(), putArtifact: vi.fn(), getById: vi.fn() };
const queue = { enqueue: vi.fn() };
const pdf = new PdfService(
  docs as unknown as DocumentsService,
  companies,
  queue as unknown as QueueProducer,
  new ConfigService<Env, true>(envSchema.parse({ NODE_ENV: "test", PDF_RI_MODE: "fake" })),
  {} as CompanyLogoService,
);
const previews = new PreviewService(
  {} as Db,
  companies,
  {} as EmitCreditNoteUseCase,
  {} as EmitDebitNoteUseCase,
  pdf,
  auxiliary,
);
function fixtures() {
  const gre = greScenario();
  const carrier = greScenario("carrier");
  if (carrier.shipment.subcontractor)
    carrier.shipment.subcontractor.identity_number = "20601234567";
  const greInput = (c: typeof gre) => {
    const { supplier, supplier_party, number, ...rest } = c;
    void supplier;
    void supplier_party;
    void number;
    return { ...rest, company_id: companyId };
  };
  return [
    { document_type: "09", document: greInput(gre) },
    { document_type: "31", document: greInput(carrier) },
    { document_type: "20", document: { ...taxAgentRequest("20"), company_id: companyId } },
    { document_type: "40", document: { ...taxAgentRequest("40"), company_id: companyId } },
    {
      document_type: "RA",
      document: {
        company_id: companyId,
        reference_date: "2026-10-08",
        issue_date: "2026-10-09",
        documents: [{ document_type: "01", serie_number: "F001-1", reason: "Error" }],
      },
    },
    {
      document_type: "RC",
      document: { company_id: companyId, reference_date: "2026-10-08", issue_date: "2026-10-09" },
    },
    {
      document_type: "RR",
      document: {
        company_id: companyId,
        document_type: "20",
        reference_date: "2026-10-08",
        issue_date: "2026-10-09",
        communicated_on: "2026-10-09",
        documents: [{ document_id: companyId, reason: "Error" }],
      },
    },
  ];
}
afterEach(() => vi.restoreAllMocks());
it.each(fixtures())(
  "builds XML and marked PDF for $document_type without writing or reading signed artifacts",
  async (input) => {
    const body = previewCreateSchema.parse(input);
    const renderer = vi.spyOn(FakePdfRenderer.prototype, "render");
    await expect(previews.xml("org", body)).resolves.toContain("<?xml");
    await expect(previews.render("org", body)).resolves.toBeInstanceOf(Buffer);
    expect(renderer).toHaveBeenLastCalledWith(
      expect.objectContaining({ preview: true, qrPayload: "", digestValue: "" }),
    );
    expect(docs.getArtifact).not.toHaveBeenCalled();
    expect(docs.putArtifact).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    renderer.mockRestore();
  },
);
it("rejects mismatched GRE type and boleta in RA", async () => {
  const body = previewCreateSchema.parse(fixtures()[0]);
  await expect(previews.build("org", { ...body, document_type: "31" } as never)).rejects.toThrow(
    "mismatch",
  );
  const ra = previewCreateSchema.parse(fixtures()[4]);
  if (ra.document_type !== "RA") throw new Error("fixture");
  const line = ra.document.documents[0];
  if (!line) throw new Error("Missing fixture line");
  line.serie_number = "B001-1";
  await expect(previews.xml("org", ra)).rejects.toThrow("F-series");
});
