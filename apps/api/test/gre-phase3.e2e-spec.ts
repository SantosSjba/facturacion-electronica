import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import Redis from "ioredis";
import sharp from "sharp";
import { S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import { AppError } from "@factosys/shared";
import {
  createDb,
  companies,
  documentArtifacts,
  documents,
  documentSeries,
  newId,
  organizations,
  type Db,
} from "@factosys/db";
import { generateTestPfx } from "@factosys/sunat-sign";
import { greScenario } from "../../../packages/sunat-ubl/test-fixtures/gre-scenarios";
import { greCdrFixture, TEST_GRE_QR } from "../../../packages/sunat-gre/test-fixtures/cdr";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";
import { CompanyLogoService } from "../src/infrastructure/companies/company-logo.service";
import { DocumentsService } from "../src/infrastructure/documents/documents.service";
import { EmitDespatchAdviceUseCase } from "../src/infrastructure/documents/emit-despatch-advice.use-case";
import type { CredentialsResolver } from "../src/infrastructure/documents/credentials-resolver";
import { IdempotencyService } from "../src/infrastructure/idempotency/idempotency.service";
import { PdfService } from "../src/infrastructure/pdf/pdf.service";
import { SeriesService } from "../src/infrastructure/series/series.service";
import { ObjectStorageService } from "../src/infrastructure/storage/object-storage.service";
import { envSchema, type Env } from "../src/infrastructure/config/env.schema";
import { SunatPollProcessor } from "../src/infrastructure/queues/sunat-poll.processor";
import type { QueueProducer } from "../src/infrastructure/queues/queue.producer";
import type { QueueJobData } from "../src/infrastructure/queues/queue.tokens";
import type { GreTokenCacheService } from "../src/infrastructure/gre/gre-token-cache.service";
import { DespatchAdvicesController } from "../src/interfaces/http/v1/despatch-advices.controller";
import { DocumentsController } from "../src/interfaces/http/v1/documents.controller";
import { ApiKeyGuard } from "../src/interfaces/http/guards/api-key.guard";
import { AppExceptionFilter } from "../src/interfaces/http/filters/app-exception.filter";
import type { ApiKeyService } from "../src/infrastructure/api-keys/api-key.service";
import type { RateLimitService } from "../src/infrastructure/redis/rate-limit.service";
import type { AuthService } from "../src/infrastructure/auth/auth.service";

// PostgreSQL, Redis and MinIO are real; SUNAT calls are replaced with explicit fixtures.
describe("phase 3 isolated GRE HTTP, persistence and rendering", () => {
  const orgId = newId(),
    companyId = newId();
  let db: Db,
    s3: S3Client,
    redis: Redis,
    app: INestApplication,
    docs: DocumentsService,
    pdf: PdfService,
    emitter: EmitDespatchAdviceUseCase,
    logos: CompanyLogoService,
    processor: SunatPollProcessor;
  const enqueue = vi.fn().mockResolvedValue({ jobId: "fixture" });
  const sendDespatch = vi
    .fn()
    .mockResolvedValue({ ticket: "11111111-1111-4111-8111-111111111111" });
  const resolveCertificate = vi.fn();
  const getStatus = vi.fn();
  let storage: ObjectStorageService;
  const logoKeys: string[] = [];
  beforeAll(async () => {
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
    );
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    await db
      .insert(organizations)
      .values({ id: orgId, name: "GRE phase3 test", slug: "gre-" + orgId });
    await db.insert(companies).values({
      id: companyId,
      organizationId: orgId,
      ruc: "20601234567",
      legalName: "GRE FIXTURE",
      address: {},
    });
    await db.insert(documentSeries).values(
      ["09", "31"].map((t) => ({
        id: newId(),
        organizationId: orgId,
        companyId,
        documentType: t,
        serie: t === "09" ? "T001" : "V001",
      })),
    );
    const config = new ConfigService<Env, true>(
      envSchema.parse({ NODE_ENV: "test", PDF_RI_MODE: "playwright", SUNAT_GRE_MODE: "beta" }),
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
    const companyService = new CompaniesService(db);
    docs = new DocumentsService(db, storage);
    logos = new CompanyLogoService(db, companyService, storage);
    const cert = generateTestPfx("gre-test");
    resolveCertificate.mockResolvedValue({ pfx: cert.pfx, password: "gre-test" });
    const credentials = {
      resolveCertificate,
      resolveGre: async () => ({}),
      resolveSol: async () => ({}),
    } as unknown as CredentialsResolver;
    const tokens = { getAccessToken: async () => "fixture" } as GreTokenCacheService;
    const queues = { enqueue } as unknown as QueueProducer;
    emitter = new EmitDespatchAdviceUseCase(
      db,
      companyService,
      new SeriesService(db, companyService),
      docs,
      credentials,
      tokens,
      queues,
      config,
    );
    Object.assign(emitter, { despatch: { sendDespatch } });
    processor = new SunatPollProcessor(docs, credentials, tokens, config);
    Object.assign(processor, { greDespatch: { getStatus } });
    pdf = new PdfService(docs, companyService, queues, config, logos);
    const module = await Test.createTestingModule({
      controllers: [DespatchAdvicesController, DocumentsController],
      providers: [
        { provide: EmitDespatchAdviceUseCase, useValue: emitter },
        { provide: IdempotencyService, useValue: new IdempotencyService(db, redis) },
        { provide: DocumentsService, useValue: docs },
        { provide: PdfService, useValue: pdf },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
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
              companyIds: [companyId],
              scopes:
                secret === "reader" ? ["documents:read"] : ["documents:read", "documents:write"],
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
      const artifacts = await db
        .select()
        .from(documentArtifacts)
        .where(eq(documentArtifacts.organizationId, orgId));
      for (const artifact of artifacts)
        if (artifact.objectKey) await storage.deleteObject(artifact.objectKey);
      for (const key of logoKeys) await storage.deleteObject(key);
      await db.delete(organizations).where(eq(organizations.id, orgId));
      await db.$client.end();
    }
    redis?.disconnect();
    s3?.destroy();
  });
  function body(kind: Parameters<typeof greScenario>[0] = "public") {
    const c = greScenario(kind);
    const { number, supplier, supplier_party, ...rest } = c;
    void number;
    void supplier;
    void supplier_party;
    return { ...rest, company_id: companyId };
  }
  const post = (b: unknown, key: string) =>
    request(app.getHttpServer())
      .post("/v1/despatch-advices")
      .auth("writer", { type: "bearer" })
      .set("Idempotency-Key", "gre-test-" + key)
      .send(b);
  it("rejects invalid GRE before signing or allocating and enforces tenant/scopes", async () => {
    const signed = resolveCertificate.mock.calls.length;
    await post(
      { ...body(), shipment: { ...body().shipment, handover_date: undefined } },
      "invalid",
    ).expect(422);
    await request(app.getHttpServer())
      .post("/v1/despatch-advices")
      .auth("reader", { type: "bearer" })
      .send(body())
      .expect(403);
    await request(app.getHttpServer())
      .post("/v1/despatch-advices")
      .auth("foreign", { type: "bearer" })
      .set("Idempotency-Key", "gre-test-foreign")
      .send(body())
      .expect(403);
    expect(resolveCertificate.mock.calls.length).toBe(signed);
    expect(sendDespatch).not.toHaveBeenCalled();
    expect(
      await db.select().from(documents).where(eq(documents.organizationId, orgId)),
    ).toHaveLength(0);
  });
  it("creates a signed GRE, blocks pending QR/PDF, stores CDR and uses historical MinIO logo", async () => {
    const logo = await sharp({
      create: { width: 120, height: 40, channels: 4, background: "#4466dd" },
    })
      .png()
      .toBuffer();
    await logos.put(orgId, companyId, logo);
    const logoRow = (await db.select().from(companies).where(eq(companies.id, companyId)))[0];
    if (!logoRow?.logo) throw new Error("Missing uploaded logo");
    logoKeys.push(logoRow.logo.objectKey);
    const created = (await post(body(), "first").expect(201)).body;
    expect(created.status).toBe("ticket_pending");
    expect(created.gre.qr_status).toBe("pending");
    const row = await docs.getById(orgId, created.id);
    expect(row.payload).toHaveProperty("_canonical");
    expect(row.payload).toHaveProperty("_print");
    const xml = (await docs.getArtifact(orgId, created.id, "xml_signed")).body.toString();
    expect(xml).toContain("DigestValue");
    expect(xml).toContain("LoadingTransportEvent");
    await request(app.getHttpServer())
      .get(created.links.pdf)
      .auth("reader", { type: "bearer" })
      .expect(409);
    await request(app.getHttpServer())
      .get(created.links.qr)
      .auth("reader", { type: "bearer" })
      .expect(409);
    getStatus.mockResolvedValueOnce({
      status: "accepted",
      rawCdrZip: greCdrFixture(),
      sunatCode: "0",
    });
    await processor.process({
      data: { organizationId: orgId, companyId, documentId: created.id },
      opts: { attempts: 8 },
      attemptsMade: 0,
    } as Job<QueueJobData>);
    const accepted = (
      await request(app.getHttpServer())
        .get(created.links.self)
        .auth("reader", { type: "bearer" })
        .expect(200)
    ).body;
    expect(accepted.gre).toMatchObject({ qr_status: "available", pdf_status: "available" });
    expect((await pdf.getQr(orgId, created.id)).payload).toBe(TEST_GRE_QR);
    await logos.remove(orgId, companyId);
    const logoRead = vi.spyOn(logos, "getDataUrl");
    const printed = await pdf.getOrRender(orgId, created.id);
    expect(printed.body.subarray(0, 4).toString()).toBe("%PDF");
    expect(logoRead).toHaveBeenCalledWith(row.logoSnapshot?.logo);
    expect((await docs.getArtifact(orgId, created.id, "pdf")).body).toEqual(printed.body);
    await expect(pdf.getOrRender(orgId, created.id)).resolves.toEqual(printed);
    const replay = (await post(body(), "first").expect(201)).body;
    expect(replay.id).toBe(created.id);
    expect(sendDespatch).toHaveBeenCalledTimes(1);
  }, 30000);
  it("retains duplicate 1033 numbering, replays the failure and reconciles without resending", async () => {
    sendDespatch.mockRejectedValueOnce(
      new AppError({ code: "HTTP", message: "Duplicate", sunatCode: "1033", stage: "transport" }),
    );
    const b = body("carrier"),
      before = sendDespatch.mock.calls.length;
    const failed = (await post(b, "duplicate").expect(201)).body;
    expect(failed).toMatchObject({
      status: "failed",
      serie_number: "V001-00000001",
      gre: { reconciliation_required: true, reason: "duplicate_1033" },
    });
    expect((await post(b, "duplicate").expect(201)).body.id).toBe(failed.id);
    expect(sendDespatch).toHaveBeenCalledTimes(before + 1);
    const ticket = "22222222-2222-4222-8222-222222222222";
    await request(app.getHttpServer())
      .post("/v1/despatch-advices/" + failed.id + "/reconcile-ticket")
      .auth("reader", { type: "bearer" })
      .send({ ticket })
      .expect(403);
    await request(app.getHttpServer())
      .post("/v1/despatch-advices/" + failed.id + "/reconcile-ticket")
      .auth("foreign", { type: "bearer" })
      .send({ ticket })
      .expect(403);
    const concurrent = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app.getHttpServer())
          .post("/v1/despatch-advices/" + failed.id + "/reconcile-ticket")
          .auth("writer", { type: "bearer" })
          .send({ ticket }),
      ),
    );
    expect(concurrent.map((r) => r.status).sort()).toEqual([201, 409]);
    const resumed = concurrent.find((r) => r.status === 201)?.body;
    expect(resumed.status).toBe("ticket_pending");
    expect(resumed.serie_number).toBe(failed.serie_number);
    expect(sendDespatch).toHaveBeenCalledTimes(before + 1);
    const exhaustPoll = async () => {
      getStatus.mockResolvedValueOnce({ status: "ticket_pending" });
      await processor.process({
        data: { organizationId: orgId, companyId, documentId: failed.id },
        opts: { attempts: 8 },
        attemptsMade: 7,
      } as Job<QueueJobData>);
    };
    for (let count = 2; count <= 3; count++) {
      await exhaustPoll();
      await request(app.getHttpServer())
        .post("/v1/despatch-advices/" + failed.id + "/reconcile-ticket")
        .auth("writer", { type: "bearer" })
        .send({ ticket })
        .expect(201);
      expect((await docs.getById(orgId, failed.id)).payload).toHaveProperty(
        "_gre.reconciliation_count",
        count,
      );
    }
    await exhaustPoll();
    await request(app.getHttpServer())
      .post("/v1/despatch-advices/" + failed.id + "/reconcile-ticket")
      .auth("writer", { type: "bearer" })
      .send({ ticket })
      .expect(409);
    expect(sendDespatch).toHaveBeenCalledTimes(before + 1);
    getStatus.mockResolvedValueOnce({
      status: "accepted",
      rawCdrZip: greCdrFixture("0", "V001-1"),
    });
    await processor.process({
      data: { organizationId: orgId, companyId, documentId: failed.id },
      opts: { attempts: 8 },
      attemptsMade: 0,
    } as Job<QueueJobData>);
    expect((await docs.getById(orgId, failed.id)).status).toBe("accepted");
  });
});
