import { generateTestPfx, verifySignedXml, loadPfx } from "@factosys/sunat-sign";
import { describe, expect, it, vi } from "vitest";
import { invoiceCreateSchema } from "../../interfaces/http/dto/invoice-create.schema";
import { receiptCreateSchema } from "../../interfaces/http/dto/receipt-create.schema";
import { creditNoteCreateSchema } from "../../interfaces/http/dto/credit-note-create.schema";
import { EmitInvoiceUseCase } from "./emit-invoice.use-case";
import { EmitReceiptUseCase } from "./emit-receipt.use-case";
import { EmitCreditNoteUseCase, EmitDebitNoteUseCase } from "./emit-note.use-case";
import type {
  EmitDocumentOrchestrator,
  EmitDocumentParams,
  EmitBuiltPayload,
} from "./emit-document.orchestrator";
import type { DocumentsService } from "./documents.service";

const body = {
  company_id: "01900000-0000-7000-8000-000000000001",
  serie: "F001",
  operation_type: "0101",
  issue_date: "2026-10-08",
  issue_time: "10:15:30",
  currency: "PEN",
  purchase_order: "OC-10",
  customer: {
    identity_type: "6",
    identity_number: "20123456789",
    name: "ACME",
    email: "cliente@example.com",
    address: { line: "Calle Uno", ubigeo: "150101" },
  },
  legends: [{ code: "1000", text: "DOSCIENTOS TREINTA Y SEIS" }],
  lines: [1, 2].map((id) => ({
    id,
    quantity: 1,
    unit_code: "NIU",
    description: `Producto ${id}`,
    unit_value: 100,
    tax_affectation: "10",
    product_code: `P-${id}`,
    sunat_product_code: "10000000",
  })),
  totals_mode: "strict",
  totals: {
    line_extension_amount: 200,
    tax_amount: 36,
    tax_inclusive_amount: 236,
    payable_amount: 236,
  },
};

describe("phase 0 HTTP input to signed UBL", () => {
  it.each(["01", "03", "07", "08"])(
    "preserves all supported data through emission %s",
    async (type) => {
      const cert = generateTestPfx("test-phase0");
      let built: EmitBuiltPayload | undefined;
      const execute = vi.fn(async (params: EmitDocumentParams) => {
        built = await params.build({
          company: {
            id: body.company_id,
            ruc: "20601234567",
            legalName: "EMISOR",
            environment: "sandbox",
            address: { line: "Dirección emisor", ubigeo: "150101" },
          },
          allocated: { number: 7, padded: "00000007" },
          pfx: cert.pfx,
          password: "test-phase0",
        });
        return {};
      });
      const orchestrator = { execute } as unknown as EmitDocumentOrchestrator;
      const documents = {
        requireAcceptedAffected: vi.fn().mockResolvedValue({ id: "affected", documentType: "01" }),
      } as unknown as DocumentsService;
      const input = { organizationId: "org", idempotencyKey: "phase0" };
      if (type === "01")
        await new EmitInvoiceUseCase(orchestrator).execute({
          ...input,
          body: invoiceCreateSchema.parse({ ...body, due_date: "2026-10-30" }),
        });
      else if (type === "03")
        await new EmitReceiptUseCase(orchestrator).execute({
          ...input,
          body: receiptCreateSchema.parse({ ...body, serie: "B001" }),
        });
      else {
        const noteBody: Partial<typeof body> = { ...body };
        delete noteBody.operation_type;
        const note = creditNoteCreateSchema.parse({
          ...noteBody,
          note_type: "01",
          reason: "Corrección",
          affected_document: { document_type: "01", serie_number: "F001-1" },
        });
        if (type === "07")
          await new EmitCreditNoteUseCase(orchestrator, documents).execute({
            ...input,
            body: note,
          });
        else
          await new EmitDebitNoteUseCase(orchestrator, documents).execute({ ...input, body: note });
      }
      if (!built) throw new Error("Emission did not build a document");
      expect(built.totals.payable_amount).toBe(236);
      expect(built.canonicalSnapshot).toMatchObject({
        lines: [{ product_code: "P-1" }, { product_code: "P-2" }],
        supplier: { address: { line: "Dirección emisor" } },
      });
      for (const text of [
        "Producto 2",
        "P-2",
        "10000000",
        "Calle Uno",
        "Dirección emisor",
        "cliente@example.com",
        "OC-10",
        "DOSCIENTOS TREINTA Y SEIS",
        "10:15:30",
      ])
        expect(built.signedXml).toContain(text);
      expect(
        verifySignedXml(built.signedXml, loadPfx(cert.pfx, "test-phase0").certificatePem),
      ).toBe(true);
    },
  );

  it.each([
    { detraction: {} },
    { payment_means: [] },
    { number: 10 },
    { operation_type: "1001" },
    { totals: { ...body.totals, payable_amount: 230 } },
  ])("rejects unsupported/inconsistent input before allocation: %o", async (patch) => {
    const execute = vi.fn();
    const useCase = new EmitInvoiceUseCase({ execute } as unknown as EmitDocumentOrchestrator);
    await expect(
      useCase.execute({
        organizationId: "org",
        idempotencyKey: "key",
        body: invoiceCreateSchema.parse({ ...body, ...patch }),
      }),
    ).rejects.toMatchObject({ httpStatus: 422, retryable: false });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects unknown nested fields rather than stripping them", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...body, lines: [{ ...body.lines[0], discount: 10 }] })
        .success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({
        ...body,
        customer: { ...body.customer, address: { typo_address: "Calle" } },
      }).success,
    ).toBe(false);
  });
});
