import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import request from "supertest";
import Redis from "ioredis";
import { S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Job } from "bullmq";
import {
  createDb,
  newId,
  organizations,
  companies,
  documents,
  documentSeries,
  documentArtifacts,
  type Db,
} from "@factosys/db";
import { generateTestPfx } from "@factosys/sunat-sign";
import { FakeBillServiceAdapter, buildCdrZipFixture } from "@factosys/sunat-soap";
import { AppError } from "@factosys/shared";
import { taxAgentRequest } from "../../../packages/sunat-ubl/test-fixtures/tax-agent-scenarios";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";
import { CompanyLogoService } from "../src/infrastructure/companies/company-logo.service";
import { DocumentsService } from "../src/infrastructure/documents/documents.service";
import { TaxAgentService } from "../src/infrastructure/documents/tax-agent.service";
import { EmitDocumentOrchestrator } from "../src/infrastructure/documents/emit-document.orchestrator";
import type { CredentialsResolver } from "../src/infrastructure/documents/credentials-resolver";
import { SeriesService } from "../src/infrastructure/series/series.service";
import { ObjectStorageService } from "../src/infrastructure/storage/object-storage.service";
import { PdfService } from "../src/infrastructure/pdf/pdf.service";
import { taxAgentPdfInput } from "../src/infrastructure/pdf/tax-agent-pdf";
import { IdempotencyService } from "../src/infrastructure/idempotency/idempotency.service";
import type { QueueProducer } from "../src/infrastructure/queues/queue.producer";
import type { QueueJobData } from "../src/infrastructure/queues/queue.tokens";
import { envSchema, type Env } from "../src/infrastructure/config/env.schema";
import { TaxAgentsController } from "../src/interfaces/http/v1/tax-agents.controller";
import { DocumentsController } from "../src/interfaces/http/v1/documents.controller";
import { ApiKeyGuard } from "../src/interfaces/http/guards/api-key.guard";
import { AppExceptionFilter } from "../src/interfaces/http/filters/app-exception.filter";
import type { ApiKeyService } from "../src/infrastructure/api-keys/api-key.service";
import type { RateLimitService } from "../src/infrastructure/redis/rate-limit.service";
import type { AuthService } from "../src/infrastructure/auth/auth.service";
import { createPdfRenderer, buildRiHtml } from "@factosys/pdf-ri";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture");
  return value;
}

describe("phase 5 isolated tax-agent lifecycle", () => {
  const org = newId();
  let companyId: string,
    db: Db,
    app: INestApplication,
    redis: Redis,
    s3: S3Client,
    storage: ObjectStorageService,
    docs: DocumentsService,
    agents: TaxAgentService,
    pdf: PdfService,
    cs: CompaniesService;
  const enqueue = vi.fn().mockResolvedValue({ jobId: "fixture" });
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T17:00:00Z"));
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
    );
    await db
      .insert(organizations)
      .values({ id: org, name: "Phase5 isolated test", slug: "phase5-" + org });
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const config = new ConfigService<Env, true>(
      envSchema.parse({ NODE_ENV: "test", SUNAT_AGENT_MODE: "fake", PDF_RI_MODE: "playwright" }),
    );
    s3 = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? "factosys",
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? "factosysdev",
      },
    });
    storage = new ObjectStorageService(s3, config);
    await storage.ensureBucket();
    cs = new CompaniesService(db);
    companyId = (
      await cs.create(org, {
        ruc: "20100070970",
        legalName: "Agente fixture",
        environment: "sandbox",
        taxAgentSettings: { retention: true, perception_regimes: ["01", "02", "03"] },
      })
    ).id;
    const series = new SeriesService(db, cs);
    await series.create(org, companyId, { documentType: "20", serie: "R001" });
    await series.create(org, companyId, { documentType: "40", serie: "P001" });
    docs = new DocumentsService(db, storage);
    const cert = generateTestPfx("phase5");
    const resolver = {
      resolveCertificate: async () => ({ pfx: cert.pfx, password: "phase5" }),
      resolveSol: async () => ({ username: "20100070970MODDATOS", password: "fixture" }),
    } as unknown as CredentialsResolver;
    const queues = { enqueue } as unknown as QueueProducer;
    agents = new TaxAgentService(
      db,
      cs,
      new EmitDocumentOrchestrator(db, cs, series, docs, resolver, queues),
      docs,
      resolver,
      queues,
      config,
    );
    pdf = new PdfService(docs, cs, queues, config, new CompanyLogoService(db, cs, storage));
    const module = await Test.createTestingModule({
      controllers: [TaxAgentsController, DocumentsController],
      providers: [
        { provide: TaxAgentService, useValue: agents },
        { provide: DocumentsService, useValue: docs },
        { provide: PdfService, useValue: pdf },
        { provide: IdempotencyService, useValue: new IdempotencyService(db, redis) },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(
      new ApiKeyGuard(
        new Reflector(),
        {
          authenticate: async (secret: string) => {
            if (!["writer", "reader", "foreign", "prod"].includes(secret))
              throw AppError.unauthorized();
            return {
              kind: "api_key",
              organizationId: secret === "foreign" ? newId() : org,
              apiKeyId: "phase5-fixture",
              companyIds: [companyId],
              scopes:
                secret === "reader" ? ["documents:read"] : ["documents:read", "documents:write"],
              environmentConstraint: secret === "prod" ? "production" : null,
            };
          },
        } as unknown as ApiKeyService,
        { consumeOrg: async () => undefined } as unknown as RateLimitService,
        new JwtService(),
        config,
        {} as AuthService,
        db,
      ),
    );
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (db) {
      for (const a of await db
        .select()
        .from(documentArtifacts)
        .where(eq(documentArtifacts.organizationId, org)))
        if (a.objectKey) await storage.deleteObject(a.objectKey);
      await db.delete(organizations).where(eq(organizations.id, org));
      await db.$client.end();
    }
    redis?.disconnect();
    s3?.destroy();
    vi.useRealTimers();
  });
  const body = (type: "20" | "40", ref = 1) => {
    const b = taxAgentRequest(type);
    required(b.documents[0]).serie_number = `F001-${ref}`;
    return { ...b, company_id: companyId };
  };
  const post = (type: "20" | "40", b: unknown, k = newId(), auth = "writer") =>
    request(app.getHttpServer())
      .post(type === "20" ? "/v1/retentions" : "/v1/perceptions")
      .auth(auth, { type: "bearer" })
      .set("Idempotency-Key", k)
      .send(b);
  const job = (id: string, attemptsMade = 0) =>
    ({
      data: { organizationId: org, companyId, documentId: id },
      opts: { attempts: 8 },
      attemptsMade,
    }) as Job<QueueJobData>;
  const rr = (id: string, k = newId(), type: "20" | "40" = "20") =>
    request(app.getHttpServer())
      .post("/v1/reversions")
      .auth("writer", { type: "bearer" })
      .set("Idempotency-Key", k)
      .send({
        company_id: companyId,
        document_type: type,
        issue_date: "2026-10-08",
        reference_date: "2026-10-08",
        communicated_on: "2026-10-08",
        documents: [{ document_id: id, reason: "Datos incorrectos" }],
      });
  it("OpenAPI publishes runtime 20/40/RR contracts", () => {
    const spec = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    for (const path of ["retentions", "perceptions", "reversions"])
      expect(spec.paths[`/v1/${path}`]?.post?.requestBody).toBeTruthy();
  });
  it("enforces scopes, organization, key environment and missing idempotency", async () => {
    await post("20", body("20"), newId(), "reader").expect(403);
    await post("20", body("20"), newId(), "foreign").expect(403);
    await post("20", body("20"), newId(), "prod").expect(403);
    await request(app.getHttpServer())
      .post("/v1/retentions")
      .auth("writer", { type: "bearer" })
      .send(body("20"))
      .expect(422);
  });
  it("agent authorization is disabled by default and enforced by regime", async () => {
    await cs.patch(org, companyId, {
      taxAgentSettings: { retention: false, perception_regimes: [] },
    });
    await post("20", body("20")).expect(422);
    await post("40", body("40")).expect(422);
    await cs.patch(org, companyId, {
      taxAgentSettings: { retention: true, perception_regimes: ["01", "02", "03"] },
    });
  });
  it.each(["20", "40"] as const)(
    "%s stores signed artifacts and CDR, historical QR, PDF and idempotency",
    async (type) => {
      const b = body(type, type === "20" ? 10 : 11),
        k = newId(),
        created = (await post(type, b, k).expect(201)).body;
      expect(created.document_type).toBe(type);
      expect(created.status).toBe("queued");
      expect((await docs.getById(org, created.id)).ublProfile).toBe("2.0");
      expect((await docs.getArtifact(org, created.id, "xml_signed")).body.toString()).toContain(
        type === "20" ? "Retention" : "Perception",
      );
      expect(enqueue).toHaveBeenCalledWith(
        "tax-agent",
        expect.objectContaining({ documentId: created.id }),
      );
      await agents.process(job(created.id));
      expect((await docs.getById(org, created.id)).status).toBe("accepted");
      expect((await docs.getArtifact(org, created.id, "cdr_xml")).body.length).toBeGreaterThan(100);
      const qr = await pdf.getQr(org, created.id);
      expect(qr.payload).toContain(`|${type}|`);
      expect(qr.payload).toContain(type === "20" ? "||35.40|" : "||23.60|");
      const historicalName = (await cs.requireCompany(org, companyId)).legalName;
      await cs.patch(org, companyId, { legalName: "Nombre posterior " + type });
      const row = await docs.getById(org, created.id),
        xml = (await docs.getArtifact(org, created.id, "xml_signed")).body.toString();
      const input = taxAgentPdfInput(row, xml);
      expect(input.issuer.legalName).toBe(historicalName);
      expect(buildRiHtml(input)).not.toContain("IGV / IVAP");
      const result = await pdf.getOrRender(org, created.id);
      expect(result.body.subarray(0, 4).toString()).toBe("%PDF");
      mkdirSync("../../tmp/pdfs/phase5", { recursive: true });
      writeFileSync(`../../tmp/pdfs/phase5/${type}-A4.pdf`, result.body);
      expect((await post(type, b, k).expect(201)).body.id).toBe(created.id);
      await post(type, { ...b, observations: "changed" }, k).expect(409);
    },
  );
  it("serializes concurrent duplicate payments and partial-payment totals", async () => {
    const b = body("20", 20);
    required(required(b.documents[0]).payments[0]).amount = 600;
    const replies = await Promise.all([post("20", b), post("20", b)]);
    expect(replies.map((r) => r.status).sort()).toEqual([201, 409]);
    const next = structuredClone(b);
    required(required(next.documents[0]).payments[0]).number = 2;
    await post("20", next).expect(409);
    required(required(next.documents[0]).payments[0]).amount = 580;
    await post("20", next).expect(201);
  });
  it("deduplicates NC across partial payments and preserves reductions between emissions", async () => {
    const b = body("40", 21);
    required(b.documents[0]).credit_notes = [
      { serie_number: "FC01-21", issue_date: "2026-10-02", total_amount: 180 },
    ];
    required(required(b.documents[0]).payments[0]).amount = 600;
    await post("40", b).expect(201);
    const next = structuredClone(b);
    required(required(next.documents[0]).payments[0]).number = 2;
    required(required(next.documents[0]).payments[0]).amount = 400;
    await post("40", next).expect(201);
    const over = body("40", 21);
    required(required(over.documents[0]).payments[0]).number = 3;
    required(required(over.documents[0]).payments[0]).amount = 1;
    await post("40", over).expect(409);
  });
  it("negative CDR releases payments; uncertain submission retains them", async () => {
    Object.assign(agents, { bill: new FakeBillServiceAdapter({ mode: "rejected" }) });
    const rejected = (await post("20", body("20", 30)).expect(201)).body;
    await agents.process(job(rejected.id));
    expect((await docs.getById(org, rejected.id)).status).toBe("rejected");
    await post("20", body("20", 30)).expect(201);
    Object.assign(agents, {
      bill: {
        sendBill: async () => {
          throw new Error("network timeout");
        },
      },
    });
    const failed = (await post("20", body("20", 31)).expect(201)).body;
    await expect(agents.process(job(failed.id))).rejects.toThrow("network timeout");
    expect((await docs.getDetails(org, failed.id)).tax_agent).toMatchObject({
      reconciliation_required: true,
    });
    await post("20", body("20", 31)).expect(409);
    Object.assign(agents, { bill: new FakeBillServiceAdapter() });
  });
  it("RR reserves originals, accepts by ticket, preserves XML/PDF and releases payments", async () => {
    const original = (await post("40", body("40", 40)).expect(201)).body;
    await agents.process(job(original.id));
    const xml = (await docs.getArtifact(org, original.id, "xml_signed")).body;
    const oldPdf = await pdf.getOrRender(org, original.id);
    const beforePreview = await db
      .select()
      .from(documents)
      .where(eq(documents.companyId, companyId));
    const beforeSeries = await db
      .select()
      .from(documentSeries)
      .where(eq(documentSeries.companyId, companyId));
    const preview = await agents.previewReversion(org, {
      company_id: companyId,
      document_type: "40",
      reference_date: "2026-10-08",
      issue_date: "2026-10-08",
      communicated_on: "2026-10-08",
      documents: [{ document_id: original.id, reason: "Error de prueba" }],
    });
    expect(preview.id).toBe("RR-20261008-1");
    expect(preview.lines.at(-1)?.serie).toBe("P001");
    expect(await db.select().from(documents).where(eq(documents.companyId, companyId))).toEqual(
      beforePreview,
    );
    expect(
      await db.select().from(documentSeries).where(eq(documentSeries.companyId, companyId)),
    ).toEqual(beforeSeries);
    const created = (await rr(original.id, newId(), "40").expect(201)).body;
    await rr(original.id, newId(), "40").expect(409);
    expect((await docs.getById(org, original.id)).status).toBe("accepted");
    await agents.process(job(created.id));
    const pending = await docs.getById(org, created.id);
    expect(pending.status).toBe("ticket_pending");
    expect(pending.sunatTicket).toBeTruthy();
    await agents.process(job(created.id));
    expect((await docs.getById(org, created.id)).status).toBe("accepted");
    expect((await docs.getDetails(org, original.id)).reversion).toMatchObject({
      status: "reversed",
      document_id: created.id,
    });
    expect((await docs.getArtifact(org, original.id, "xml_signed")).body).toEqual(xml);
    expect(await pdf.getOrRender(org, original.id)).toEqual(oldPdf);
    expect((await docs.getById(org, original.id)).status).toBe("cancelled");
    await post("40", body("40", 40)).expect(201);
    const printed = await pdf.getOrRender(org, created.id);
    writeFileSync("../../tmp/pdfs/phase5/RR-A4.pdf", printed.body);
  });
  it("rejected RR unlocks original but does not release its payments", async () => {
    const original = (await post("20", body("20", 50)).expect(201)).body;
    await agents.process(job(original.id));
    Object.assign(agents, { bill: new FakeBillServiceAdapter({ mode: "rejected" }) });
    const created = (await rr(original.id).expect(201)).body;
    await agents.process(job(created.id));
    await agents.process(job(created.id));
    expect((await docs.getById(org, original.id)).status).toBe("accepted");
    await post("20", body("20", 50)).expect(409);
    const retry = (await rr(original.id).expect(201)).body;
    Object.assign(agents, { bill: new FakeBillServiceAdapter() });
    await agents.process(job(retry.id));
    await agents.process(job(retry.id));
  });
  it("exhausted RR polling preserves ticket and reconciles without resubmission", async () => {
    const original = (await post("20", body("20", 60)).expect(201)).body;
    await agents.process(job(original.id));
    const created = (await rr(original.id).expect(201)).body;
    await agents.process(job(created.id));
    const ticket = (await docs.getById(org, created.id)).sunatTicket;
    const canonical = (await docs.getById(org, created.id)).payload as {
      _canonical: { lines: unknown[] };
    };
    expect(canonical._canonical.lines.length).toBeGreaterThan(1);
    const sendSummary = vi.fn(),
      getStatus = vi.fn().mockRejectedValue(new Error("ticket pending"));
    Object.assign(agents, { bill: { getStatus, sendSummary } });
    await agents.process(job(created.id, 7));
    expect((await docs.getById(org, created.id)).sunatTicket).toBe(ticket);
    expect((await docs.getDetails(org, created.id)).tax_agent).toMatchObject({
      reconciliation_required: true,
    });
    await agents.reconcile(org, created.id);
    expect(sendSummary).not.toHaveBeenCalled();
    Object.assign(agents, { bill: new FakeBillServiceAdapter() });
    await agents.process(job(created.id));
    expect((await docs.getById(org, created.id)).status).toBe("accepted");
  });
  it("refuses production simulation and unsupported references in RR", async () => {
    await db
      .update(companies)
      .set({ environment: "production" })
      .where(eq(companies.id, companyId));
    await post("20", body("20", 70)).expect(422);
    await db.update(companies).set({ environment: "sandbox" }).where(eq(companies.id, companyId));
    const pending = (await post("20", body("20", 70)).expect(201)).body;
    await rr(pending.id).expect(422);
  });
  it("rejects mismatched real CDR without treating the document as accepted", async () => {
    const created = (await post("20", body("20", 71)).expect(201)).body;
    await db
      .update(documents)
      .set({ environment: "production" })
      .where(eq(documents.id, created.id));
    Object.assign(agents, {
      fake: false,
      bill: {
        sendBill: async () => ({
          rawCdrZip: buildCdrZipFixture("accepted", { documentReferenceId: "R999-99" }),
        }),
      },
    });
    await expect(agents.process(job(created.id))).rejects.toThrow("CDR identity");
    expect((await docs.getById(org, created.id)).status).toBe("failed");
    Object.assign(agents, { fake: true, bill: new FakeBillServiceAdapter() });
  });
  it("validates future emission, RR communication deadline, and regime 03 confirmation", async () => {
    await post("20", { ...body("20", 72), issue_date: "2026-10-09" }).expect(422);
    await post("40", { ...body("40", 72), regime: "03" }).expect(422);
    const original = (await post("40", body("40", 73)).expect(201)).body;
    await agents.process(job(original.id));
    await request(app.getHttpServer())
      .post("/v1/reversions")
      .auth("writer", { type: "bearer" })
      .set("Idempotency-Key", newId())
      .send({
        company_id: companyId,
        document_type: "40",
        issue_date: "2026-10-08",
        reference_date: "2026-10-08",
        communicated_on: "2026-09-29",
        documents: [{ document_id: original.id, reason: "Error" }],
      })
      .expect(422);
  });
  it("renders multi-page and ticket tax-agent layout with all references", async () => {
    const b = body("40", 80);
    required(b.documents[0]).payments = [...Array(25)].map((_, i) => ({
      number: i + 1,
      date: "2026-10-08",
      amount: 40,
    }));
    const created = (await post("40", b).expect(201)).body;
    await agents.process(job(created.id));
    const row = await docs.getById(org, created.id),
      xml = (await docs.getArtifact(org, created.id, "xml_signed")).body.toString();
    const input = taxAgentPdfInput(row, xml);
    const renderer = createPdfRenderer("playwright");
    for (const format of ["A4", "A5", "TICKET80", "TICKET58"] as const) {
      const bytes = await renderer.render({ ...input, format });
      expect(bytes.length).toBeGreaterThan(5000);
      writeFileSync(`../../tmp/pdfs/phase5/40-long-${format}.pdf`, bytes);
    }
  });
  it("repairs missing queue jobs but never resubmits interrupted sendBill", async () => {
    const queued = (await post("20", body("20", 90)).expect(201)).body;
    const uncertain = (await post("20", body("20", 91)).expect(201)).body;
    const stale = new Date(Date.now() - 180000);
    await db.update(documents).set({ updatedAt: stale }).where(eq(documents.id, queued.id));
    await db
      .update(documents)
      .set({ status: "sent", sentAt: stale, updatedAt: stale })
      .where(eq(documents.id, uncertain.id));
    enqueue.mockClear();
    await agents.sweep();
    expect(enqueue).toHaveBeenCalledWith(
      "tax-agent",
      expect.objectContaining({ documentId: queued.id }),
      expect.any(Object),
    );
    expect(enqueue.mock.calls.some((c) => c[1].documentId === uncertain.id)).toBe(false);
    expect((await docs.getDetails(org, uncertain.id)).tax_agent).toMatchObject({
      reconciliation_required: true,
    });
    await post("20", body("20", 91)).expect(409);
  });
});
