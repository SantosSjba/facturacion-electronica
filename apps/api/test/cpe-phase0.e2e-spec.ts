import { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import {
  companies,
  createDb,
  documentArtifacts,
  documentSeries,
  newId,
  organizations,
  type Db,
} from "@factosys/db";
import { generateTestPfx } from "@factosys/sunat-sign";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";
import { CompanyLogoService } from "../src/infrastructure/companies/company-logo.service";
import { envSchema, type Env } from "../src/infrastructure/config/env.schema";
import type { CredentialsResolver } from "../src/infrastructure/documents/credentials-resolver";
import { DocumentsService } from "../src/infrastructure/documents/documents.service";
import { EmitDocumentOrchestrator } from "../src/infrastructure/documents/emit-document.orchestrator";
import { EmitInvoiceUseCase } from "../src/infrastructure/documents/emit-invoice.use-case";
import { EmitReceiptUseCase } from "../src/infrastructure/documents/emit-receipt.use-case";
import {
  EmitCreditNoteUseCase,
  EmitDebitNoteUseCase,
} from "../src/infrastructure/documents/emit-note.use-case";
import { PdfService } from "../src/infrastructure/pdf/pdf.service";
import type { QueueProducer } from "../src/infrastructure/queues/queue.producer";
import { SeriesService } from "../src/infrastructure/series/series.service";
import { ObjectStorageService } from "../src/infrastructure/storage/object-storage.service";
import { invoiceCreateSchema } from "../src/interfaces/http/dto/invoice-create.schema";
import { receiptCreateSchema } from "../src/interfaces/http/dto/receipt-create.schema";
import { creditNoteCreateSchema } from "../src/interfaces/http/dto/credit-note-create.schema";

// Real persistence, numbering, signature and MinIO; no external SUNAT sends or demo-account changes.
describe("phase 0 isolated CPE persistence integration", () => {
  const orgId = newId();
  const companyId = newId();
  let db: Db;
  let s3: S3Client;
  let storage: ObjectStorageService;
  let docs: DocumentsService;
  let emitter: EmitDocumentOrchestrator;
  let pdf: PdfService;

  beforeAll(async () => {
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
    );
    await db
      .insert(organizations)
      .values({ id: orgId, name: "Phase 0 fixture", slug: `phase0-${orgId}` });
    await db.insert(companies).values({
      id: companyId,
      organizationId: orgId,
      ruc: "20601234567",
      legalName: "EMISOR PHASE0",
      address: { line: "Dirección emisor", ubigeo: "150101" },
    });
    await db.insert(documentSeries).values(
      (
        [
          ["01", "F001"],
          ["03", "B001"],
          ["07", "FC01"],
          ["08", "FD01"],
        ] as const
      ).map(([documentType, serie]) => ({
        id: newId(),
        organizationId: orgId,
        companyId,
        documentType,
        serie,
      })),
    );
    const config = new ConfigService<Env, true>(
      envSchema.parse({ NODE_ENV: "test", PDF_RI_MODE: "playwright" }),
    );
    s3 = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
      region: process.env.MINIO_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? "factosys",
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? "factosysdev",
      },
    });
    storage = new ObjectStorageService(s3, config);
    await storage.ensureBucket();
    const companyService = new CompaniesService(db);
    docs = new DocumentsService(db, storage);
    const cert = generateTestPfx("phase0-fixture");
    const credentials = {
      resolveCertificate: async () => ({ pfx: cert.pfx, password: "phase0-fixture" }),
      resolveSol: async () => ({}),
    } as unknown as CredentialsResolver;
    const queues = { enqueue: async () => ({}) } as unknown as QueueProducer;
    emitter = new EmitDocumentOrchestrator(
      db,
      companyService,
      new SeriesService(db, companyService),
      docs,
      credentials,
      queues,
    );
    pdf = new PdfService(
      docs,
      companyService,
      queues,
      config,
      new CompanyLogoService(db, companyService, storage),
    );
  });

  afterAll(async () => {
    if (db) {
      const artifacts = await db
        .select()
        .from(documentArtifacts)
        .where(eq(documentArtifacts.organizationId, orgId));
      for (const artifact of artifacts)
        if (artifact.objectKey) await storage.deleteObject(artifact.objectKey);
      await db.delete(organizations).where(eq(organizations.id, orgId));
      await db.$client.end();
    }
    s3?.destroy();
  });

  it("persists every line and fiscal snapshot for invoice, receipt and notes", async () => {
    const common = {
      company_id: companyId,
      issue_date: "2026-10-08",
      issue_time: "10:15:30",
      currency: "PEN",
      purchase_order: "OC-PHASE0",
      customer: {
        identity_type: "6",
        identity_number: "20123456789",
        name: "CLIENTE",
        address: { line: "Calle Uno" },
      },
      lines: [1, 2].map((id) => ({
        id,
        quantity: 1,
        unit_code: "NIU",
        description: `Producto ${id}`,
        unit_value: 100,
        tax_affectation: "10",
        product_code: `P-${id}`,
      })),
      totals_mode: "strict",
      totals: {
        line_extension_amount: 200,
        tax_amount: 36,
        tax_inclusive_amount: 236,
        payable_amount: 236,
      },
    };
    const input = { organizationId: orgId, idempotencyKey: newId() };
    const invoice = await new EmitInvoiceUseCase(emitter).execute({
      ...input,
      body: invoiceCreateSchema.parse({
        ...common,
        serie: "F001",
        operation_type: "0101",
        due_date: "2026-10-30",
      }),
    });
    await docs.transitionStatus(invoice.id, "queued", "sent");
    await docs.transitionStatus(invoice.id, "sent", "accepted");
    const receipt = await new EmitReceiptUseCase(emitter).execute({
      ...input,
      idempotencyKey: newId(),
      body: receiptCreateSchema.parse({ ...common, serie: "B001", operation_type: "0101" }),
    });
    const note = {
      ...common,
      reason: "Corrección",
      note_type: "01",
      affected_document: { document_type: "01", serie_number: invoice.serie_number },
    };
    const credit = await new EmitCreditNoteUseCase(emitter, docs).execute({
      ...input,
      idempotencyKey: newId(),
      body: creditNoteCreateSchema.parse({ ...note, serie: "FC01" }),
    });
    const debit = await new EmitDebitNoteUseCase(emitter, docs).execute({
      ...input,
      idempotencyKey: newId(),
      body: creditNoteCreateSchema.parse({ ...note, serie: "FD01" }),
    });
    for (const doc of [invoice, receipt, credit, debit]) {
      const row = await docs.getById(orgId, doc.id);
      expect(row.totals).toMatchObject({ payable_amount: 236 });
      expect(row.payload).toHaveProperty("_canonical.lines.1.product_code", "P-2");
      expect(row.payload).toHaveProperty("_canonical.supplier.address.line", "Dirección emisor");
      const xml = await docs.getArtifact(orgId, doc.id, "xml_signed");
      expect(xml.body.toString()).toContain("Producto 2");
      const rendered = await pdf.renderAndStore(orgId, doc.id);
      expect(rendered.subarray(0, 5).toString()).toBe("%PDF-");
      expect((await docs.getArtifact(orgId, doc.id, "pdf")).body).toEqual(rendered);
    }
    expect((await docs.getById(orgId, credit.id)).relatedDocumentId).toBe(invoice.id);
  }, 20000);
});
