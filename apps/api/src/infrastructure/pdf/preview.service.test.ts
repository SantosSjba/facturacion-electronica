import { expect, it, vi } from "vitest";
import type { Db } from "@factosys/db";
import { phase1Request } from "../../../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import type { CompaniesService } from "../companies/companies.service";
import type { EmitCreditNoteUseCase, EmitDebitNoteUseCase } from "../documents/emit-note.use-case";
import { previewCreateSchema } from "../../interfaces/http/dto/preview-create.schema";
import { PreviewService } from "./preview.service";
import type { PdfService } from "./pdf.service";
it("limits concurrent previews per organization and process and releases capacity", async () => {
  const pdf = { renderPreview: vi.fn().mockResolvedValue(Buffer.from("PDF")) };
  const service = new PreviewService(
    {} as Db,
    {} as CompaniesService,
    {} as EmitCreditNoteUseCase,
    {} as EmitDebitNoteUseCase,
    pdf as unknown as PdfService,
  );
  let release!: (value: Awaited<ReturnType<PreviewService["build"]>>) => void;
  const build = new Promise<Awaited<ReturnType<PreviewService["build"]>>>((resolve) => {
    release = resolve;
  });
  vi.spyOn(service, "build").mockReturnValue(build);
  const body = previewCreateSchema.parse({
    document_type: "01",
    document: { ...phase1Request(), company_id: "00000000-0000-4000-8000-000000000001" },
  });
  const requests = [service.render("org-a", body), service.render("org-a", body)];
  await expect(service.render("org-a", body)).rejects.toMatchObject({ status: 429 });
  requests.push(service.render("org-b", body), service.render("org-b", body));
  await expect(service.render("org-c", body)).rejects.toMatchObject({ status: 429 });
  release({ canonical: { document_type: "01" }, xml: "preview" } as Awaited<
    ReturnType<PreviewService["build"]>
  >);
  await Promise.all(requests);
  await expect(service.render("org-a", body)).resolves.toEqual(Buffer.from("PDF"));
});
