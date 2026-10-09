import {
  phase1Request,
  phase1Scenarios,
} from "../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
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
describe("phase 1 isolated commercial persistence integration", () => {
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

  it("persists and renders all phase 1 scenarios with accepted prepayments", async () => {
    const invoiceEmitter = new EmitInvoiceUseCase(emitter);
    const emit = async (raw: unknown) =>
      invoiceEmitter.execute({
        organizationId: orgId,
        idempotencyKey: newId(),
        body: invoiceCreateSchema.parse(raw),
      });
    const accept = async (id: string) => {
      await docs.transitionStatus(id, "queued", "sent");
      await docs.transitionStatus(id, "sent", "accepted");
    };
    const fixture = phase1Request();
    const source = await emit({
      ...fixture,
      company_id: companyId,
      issue_date: "2026-10-01",
      payment_terms: {
        condition: "credit",
        currency: "PEN",
        outstanding_amount: 118,
        installments: [{ number: 1, due_date: "2026-11-08", amount: 118 }],
      },
    });
    await accept(source.id);
    const sourceIsc = await emit({
      ...fixture,
      company_id: companyId,
      issue_date: "2026-10-01",
      lines: fixture.lines.map((l) => ({ ...l, isc: { system: "01", percent: 10 } })),
    });
    await accept(sourceIsc.id);
    for (const r of phase1Scenarios()) {
      const body = {
        ...r,
        company_id: companyId,
        prepayments: r.prepayments?.map((p) => ({
          ...p,
          serie_number: (p.isc_amount ? sourceIsc : source).serie_number ?? "",
          issuer_ruc: "20601234567",
        })),
      };
      const doc = await emit(body);
      const row = await docs.getById(orgId, doc.id);
      expect(row.payload).toHaveProperty("_canonical.lines");
      const xml = (await docs.getArtifact(orgId, doc.id, "xml_signed")).body.toString();
      expect(xml).toContain("SignedInfo");
      const rendered = await pdf.renderAndStore(orgId, doc.id);
      expect(rendered.subarray(0, 5).toString()).toBe("%PDF-");
      expect((await docs.getArtifact(orgId, doc.id, "pdf")).body).toEqual(rendered);
      if (r.prepayments?.length) expect(xml).toContain("PrepaidAmount");
      // The same commercial fields are valid for individual receipts.
      const receipt = await new EmitReceiptUseCase(emitter).execute({
        organizationId: orgId,
        idempotencyKey: newId(),
        body: receiptCreateSchema.parse({ ...body, serie: "B001", send_individually: true }),
      });
      expect((await pdf.renderAndStore(orgId, receipt.id)).subarray(0, 5).toString()).toBe("%PDF-");
    }
    const first = fixture.lines[0];
    if (!first) throw new Error("Missing line");
    const quota = await new EmitCreditNoteUseCase(emitter, docs).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: creditNoteCreateSchema.parse({
        company_id: companyId,
        serie: "FC01",
        issue_date: "2026-10-08",
        currency: "PEN",
        customer: fixture.customer,
        lines: [{ ...first, unit_value: 0, unit_price: 0 }],
        note_type: "13",
        reason: "Nuevas cuotas",
        affected_document: { document_type: "01", serie_number: source.serie_number },
        payment_terms: {
          condition: "credit",
          currency: "PEN",
          outstanding_amount: 118,
          installments: [
            { number: 1, due_date: "2026-11-08", amount: 50 },
            { number: 2, due_date: "2026-12-08", amount: 68 },
          ],
        },
      }),
    });
    expect(quota.totals.payable_amount).toBe(0);
    expect((await docs.getArtifact(orgId, quota.id, "xml_signed")).body.toString()).toContain(
      "Cuota002",
    );
    expect((await pdf.renderAndStore(orgId, quota.id)).subarray(0, 5).toString()).toBe("%PDF-");
    for (const type of ["07", "08"] as const) {
      const noteBody = creditNoteCreateSchema.parse({
        issue_date: fixture.issue_date,
        currency: fixture.currency,
        customer: fixture.customer,
        company_id: companyId,
        serie: type === "07" ? "FC01" : "FD01",
        note_type: type === "07" ? "05" : "02",
        reason: "Ajuste comercial",
        affected_document: { document_type: "01", serie_number: source.serie_number },
        lines: [
          { ...first, unit_value: 10, adjustments: [{ code: "00", base_amount: 10, amount: 1 }] },
        ],
      });
      const note = await (
        type === "07"
          ? new EmitCreditNoteUseCase(emitter, docs)
          : new EmitDebitNoteUseCase(emitter, docs)
      ).execute({ organizationId: orgId, idempotencyKey: newId(), body: noteBody });
      expect((await docs.getArtifact(orgId, note.id, "xml_signed")).body.toString()).toContain(
        "AllowanceCharge",
      );
      expect((await pdf.renderAndStore(orgId, note.id)).subarray(0, 5).toString()).toBe("%PDF-");
    }
    // Reject a reused advance that would overrun the accepted source amount.
    await expect(
      emit({
        ...fixture,
        company_id: companyId,
        prepayments: [
          {
            id: 1,
            document_type: "01",
            serie_number: source.serie_number,
            issuer_ruc: "20601234567",
            paid_date: "2026-10-01",
            amount: 118,
            base_amount: 100,
            tax_affectation: "10",
          },
        ],
      }),
    ).rejects.toMatchObject({ httpStatus: 422 });
    // Two concurrent regularizations each request all of a fresh advance: only one may reserve it.
    const concurrentSource = await emit({ ...fixture, company_id: companyId });
    await accept(concurrentSource.id);
    const regularization = {
      ...fixture,
      company_id: companyId,
      prepayments: [
        {
          id: 1,
          document_type: "01",
          serie_number: concurrentSource.serie_number,
          issuer_ruc: "20601234567",
          paid_date: "2026-10-08",
          amount: 118,
          base_amount: 100,
          tax_affectation: "10",
        },
      ],
    };
    const attempts = await Promise.allSettled([emit(regularization), emit(regularization)]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((a) => a.status === "rejected")).toHaveLength(1);
  }, 60000);
});
