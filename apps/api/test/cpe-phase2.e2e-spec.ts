import { json } from "express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { enrichInvoicingRequestBodies } from "../src/infrastructure/openapi/enrich-invoicing-bodies";
import { EmitDailySummaryUseCase } from "../src/infrastructure/documents/emit-daily-summary.use-case";
import { EmitVoidedDocumentUseCase } from "../src/infrastructure/documents/emit-voided-document.use-case";
import { SummaryPoolService } from "../src/infrastructure/documents/summary-pool.service";
import { dailySummaryCreateSchema } from "../src/interfaces/http/dto/daily-summary-create.schema";
import { voidedDocumentCreateSchema } from "../src/interfaces/http/dto/voided-document-create.schema";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppError } from "@factosys/shared";
import { PreviewService } from "../src/infrastructure/pdf/preview.service";
import { PreviewsController } from "../src/interfaces/http/v1/previews.controller";
import { DocumentsController } from "../src/interfaces/http/v1/documents.controller";
import { ApiKeyGuard } from "../src/interfaces/http/guards/api-key.guard";
import { AppExceptionFilter } from "../src/interfaces/http/filters/app-exception.filter";
import type { ApiKeyService } from "../src/infrastructure/api-keys/api-key.service";
import type { RateLimitService } from "../src/infrastructure/redis/rate-limit.service";
import type { AuthService } from "../src/infrastructure/auth/auth.service";
import { previewCreateSchema } from "../src/interfaces/http/dto/preview-create.schema";
import { phase1Request } from "../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import {
  companies,
  createDb,
  documentArtifacts,
  documents,
  documentEvents,
  documentSeries,
  newId,
  organizations,
  type Db,
} from "@factosys/db";
import { generateTestPfx } from "@factosys/sunat-sign";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

// Real persistence, numbering, signature and MinIO; no external SUNAT sends or demo-account changes.
describe("phase 2 isolated print and preview HTTP integration", () => {
  const orgId = newId();
  const companyId = newId();
  let db: Db;
  let s3: S3Client;
  let storage: ObjectStorageService;
  let docs: DocumentsService;
  let emitter: EmitDocumentOrchestrator;
  let pdf: PdfService;
  let previews: PreviewService;
  let companyService: CompaniesService;
  let app: INestApplication;
  let config: ConfigService<Env, true>;
  let credentials: CredentialsResolver;
  const resolveCertificate = vi.fn();
  const enqueue = vi.fn().mockResolvedValue({});

  beforeAll(async () => {
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
    );
    await db
      .insert(organizations)
      .values({ id: orgId, name: "Phase 2 fixture", slug: `phase2-${orgId}` });
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
    config = new ConfigService<Env, true>(
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
    companyService = new CompaniesService(db);
    docs = new DocumentsService(db, storage);
    const cert = generateTestPfx("phase2-fixture");
    resolveCertificate.mockResolvedValue({ pfx: cert.pfx, password: "phase0-fixture" });
    credentials = {
      resolveCertificate: async () => ({ pfx: cert.pfx, password: "phase2-fixture" }),
      resolveSol: async () => ({}),
    } as unknown as CredentialsResolver;
    const queues = { enqueue } as unknown as QueueProducer;
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
    previews = new PreviewService(
      db,
      companyService,
      new EmitCreditNoteUseCase(emitter, docs),
      new EmitDebitNoteUseCase(emitter, docs),
      pdf,
    );
    const module = await Test.createTestingModule({
      controllers: [PreviewsController, DocumentsController],
      providers: [
        { provide: PreviewService, useValue: previews },
        { provide: DocumentsService, useValue: docs },
        { provide: PdfService, useValue: pdf },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use("/v1/previews", json({ limit: "200kb" }));
    app.useGlobalGuards(
      new ApiKeyGuard(
        new Reflector(),
        {
          authenticate: async (secret: string) => {
            if (!["writer", "reader", "foreign"].includes(secret)) throw AppError.unauthorized();
            return {
              kind: "api_key",
              organizationId: secret === "foreign" ? newId() : orgId,
              apiKeyId: "fixture",
              scopes:
                secret === "reader" ? ["documents:read"] : ["documents:read", "documents:write"],
            };
          },
        } as unknown as ApiKeyService,
        { consumeOrg: async () => undefined } as unknown as RateLimitService,
        new JwtService(),
        config,
        {} as AuthService,
      ),
    );
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
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

  const invoiceBody = () => ({ ...phase1Request(), company_id: companyId });
  const snapshot = async () => ({
    series: await db.select().from(documentSeries).where(eq(documentSeries.organizationId, orgId)),
    docs: await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.organizationId, orgId)),
    events: await db
      .select({ id: documentEvents.id })
      .from(documentEvents)
      .where(eq(documentEvents.organizationId, orgId)),
    artifacts: await db
      .select({ id: documentArtifacts.id })
      .from(documentArtifacts)
      .where(eq(documentArtifacts.organizationId, orgId)),
    signed: resolveCertificate.mock.calls.length,
    queued: enqueue.mock.calls.length,
  });

  it("protects preview routes with write scope, organization ownership and request limits", async () => {
    const body = { document_type: "01", document: invoiceBody() };
    await request(app.getHttpServer()).post("/v1/previews/validate").send(body).expect(401);
    await request(app.getHttpServer())
      .post("/v1/previews/validate")
      .auth("reader", { type: "bearer" })
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post("/v1/previews/validate")
      .auth("foreign", { type: "bearer" })
      .send(body)
      .expect(404);
    await request(app.getHttpServer())
      .post("/v1/previews/validate")
      .auth("writer", { type: "bearer" })
      .send({
        ...body,
        document: {
          ...body.document,
          lines: Array.from({ length: 501 }, (_, i) => ({ ...body.document.lines[0], id: i + 1 })),
        },
      })
      .expect(422);
    await request(app.getHttpServer())
      .post("/v1/previews/validate")
      .auth("writer", { type: "bearer" })
      .send({ ...body, document: { ...body.document, number: 12 } })
      .expect(422);
  });

  it("previews validation/XML/PDF without changing rows, numbering, artifacts, signing or queues", async () => {
    const before = await snapshot();
    const body = {
      document_type: "01",
      document: { ...invoiceBody(), observations: "Observación <segura>", pdf_format: "A5" },
    };
    const result = await request(app.getHttpServer())
      .post("/v1/previews/validate")
      .auth("writer", { type: "bearer" })
      .send(body)
      .expect(200);
    expect(result.body).toMatchObject({
      preview: true,
      sent_to_sunat: false,
      numbering_reserved: false,
      totals: { payable_amount: 118 },
    });
    const xml = await previews.xml(orgId, previewCreateSchema.parse(body));
    expect(xml).toContain("Observación &lt;segura&gt;");
    expect(xml).not.toContain("DigestValue");
    expect(xml).toContain("F001-00000001");
    const xmlHttp = await request(app.getHttpServer())
      .post("/v1/previews/xml")
      .auth("writer", { type: "bearer" })
      .send(body)
      .expect(200);
    expect(xmlHttp.headers["x-factosys-preview"]).toBe("true");
    const pdfHttp = await request(app.getHttpServer())
      .post("/v1/previews/pdf")
      .auth("writer", { type: "bearer" })
      .send(body)
      .expect(200);
    expect(pdfHttp.headers["content-type"]).toContain("application/pdf");
    expect(await snapshot()).toEqual(before);
  }, 30000);

  it("persists company defaults and document overrides; QR uses the definitive signed digest", async () => {
    await companyService.patch(orgId, companyId, { pdfFormat: "TICKET80" });
    const usecase = new EmitInvoiceUseCase(emitter);
    const doc = await usecase.execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: invoiceCreateSchema.parse(invoiceBody()),
    });
    expect(doc.printing).toEqual({ format: "TICKET80", template_version: "ri-v2" });
    const old = await pdf.getOrRender(orgId, doc.id);
    await companyService.patch(orgId, companyId, {
      pdfFormat: "A4",
      legalName: "EMISOR MODIFICADO",
    });
    expect((await pdf.getOrRender(orgId, doc.id)).body).toEqual(old.body);
    const overridden = await usecase.execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: invoiceCreateSchema.parse({ ...invoiceBody(), pdf_format: "TICKET58" }),
    });
    expect(overridden.printing?.format).toBe("TICKET58");
    const qr = await request(app.getHttpServer())
      .get(`/v1/documents/${doc.id}/qr`)
      .auth("reader", { type: "bearer" })
      .expect(200);
    const signed = (await docs.getArtifact(orgId, doc.id, "xml_signed")).body.toString();
    const digest = signed.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/)?.[1];
    expect(qr.body.payload.split("|").at(-1)).toBe(digest);
    expect(qr.body.payload).toContain("|18.00|118.00|");
    await request(app.getHttpServer())
      .get(`/v1/documents/${doc.id}/qr.png`)
      .auth("reader", { type: "bearer" })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/documents/${doc.id}/qr`)
      .auth("foreign", { type: "bearer" })
      .expect(404);
  }, 30000);

  it("notes reuse accepted-document validation and cannot exceed the source amount", async () => {
    const original = await new EmitInvoiceUseCase(emitter).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: invoiceCreateSchema.parse(invoiceBody()),
    });
    await docs.transitionStatus(original.id, "queued", "sent");
    await docs.transitionStatus(original.id, "sent", "accepted");
    const base = invoiceBody();
    const body = {
      document_type: "07",
      document: {
        company_id: companyId,
        serie: "FC01",
        currency: base.currency,
        customer: base.customer,
        lines: base.lines,
        issue_date: base.issue_date,
        note_type: "01",
        reason: "Anulación",
        affected_document: { document_type: "01", serie_number: original.serie_number },
      },
    };
    const before = await snapshot();
    expect(await previews.validate(orgId, previewCreateSchema.parse(body))).toMatchObject({
      preview: true,
      totals: { payable_amount: 118 },
    });
    await expect(
      previews.validate(
        orgId,
        previewCreateSchema.parse({
          ...body,
          document: {
            ...body.document,
            lines: body.document.lines.map((line) => ({ ...line, unit_value: 200 })),
          },
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 422 });
    expect(await snapshot()).toEqual(before);
  });
  it("renders real persisted RC/RA with ticket and result, separate from CPE", async () => {
    const series = new SeriesService(db, companyService);
    const queues = { enqueue } as unknown as QueueProducer;
    const receipt = await new EmitReceiptUseCase(emitter).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: receiptCreateSchema.parse({ ...invoiceBody(), serie: "B001" }),
    });
    const rc = await new EmitDailySummaryUseCase(
      db,
      companyService,
      series,
      docs,
      credentials,
      queues,
      new SummaryPoolService(docs),
      config,
    ).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: dailySummaryCreateSchema.parse({
        company_id: companyId,
        reference_date: "2026-10-08",
        document_ids: [receipt.id],
      }),
    });
    expect(rc.sunat_ticket).toBeTruthy();
    expect((await docs.getById(orgId, rc.id)).payload).toHaveProperty("_canonical.lines");
    expect((await pdf.getOrRender(orgId, rc.id)).body.subarray(0, 5).toString()).toBe("%PDF-");
    await expect(pdf.getQr(orgId, rc.id)).rejects.toMatchObject({ httpStatus: 422 });
    const original = await new EmitInvoiceUseCase(emitter).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: invoiceCreateSchema.parse(invoiceBody()),
    });
    await docs.transitionStatus(original.id, "queued", "sent");
    await docs.transitionStatus(original.id, "sent", "accepted");
    const ra = await new EmitVoidedDocumentUseCase(
      db,
      companyService,
      series,
      docs,
      credentials,
      queues,
      config,
    ).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: voidedDocumentCreateSchema.parse({
        company_id: companyId,
        reference_date: "2026-10-08",
        documents: [
          { document_type: "01", serie_number: original.serie_number, reason: "Error de emisión" },
        ],
      }),
    });
    expect(ra.sunat_ticket).toBeTruthy();
    expect((await pdf.getOrRender(orgId, ra.id)).body.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);

  it("keeps the first stored PDF when two renderers race", async () => {
    const doc = await new EmitInvoiceUseCase(emitter).execute({
      organizationId: orgId,
      idempotencyKey: newId(),
      body: invoiceCreateSchema.parse(invoiceBody()),
    });
    const [a, b] = await Promise.all([
      pdf.renderAndStore(orgId, doc.id),
      pdf.renderAndStore(orgId, doc.id),
    ]);
    expect(a).toEqual(b);
    expect((await docs.getArtifact(orgId, doc.id, "pdf")).body).toEqual(a);
  }, 30000);
  it("publishes the discriminated preview payloads and QR routes in OpenAPI", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    enrichInvoicingRequestBodies(document);
    for (const output of ["validate", "xml", "pdf"]) {
      const operation = document.paths[`/v1/previews/${output}`]?.post;
      expect(operation?.requestBody).toBeTruthy();
      expect(JSON.stringify(operation?.requestBody)).toContain("pdf_format");
      expect(JSON.stringify(operation?.requestBody)).toContain("observations");
    }
    expect(document.paths["/v1/documents/{id}/qr"]?.get).toBeTruthy();
    expect(document.paths["/v1/documents/{id}/qr.png"]?.get).toBeTruthy();
  });
});
