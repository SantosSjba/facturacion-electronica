import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import request from "supertest";
import { S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import {
  createDb,
  newId,
  organizations,
  companies,
  documents,
  documentSeries,
  documentArtifacts,
  documentDeliveries,
  documentShares,
  credentials,
  auditEvents,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";
import { generateTestPfx } from "@factosys/sunat-sign";
import { buildCdrZipFixture } from "@factosys/sunat-soap";
import { phase1Request } from "../../../packages/sunat-ubl/test-fixtures/commercial-scenarios";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";
import { CompanyLogoService } from "../src/infrastructure/companies/company-logo.service";
import { CredentialsService } from "../src/infrastructure/credentials/credentials.service";
import { CredentialsVault } from "../src/infrastructure/crypto/credentials-vault";
import { DocumentsService } from "../src/infrastructure/documents/documents.service";
import { CdrRecoveryService } from "../src/infrastructure/documents/cdr-recovery.service";
import { DocumentDeliveryService } from "../src/infrastructure/documents/document-delivery.service";
import { DocumentAccessService } from "../src/infrastructure/documents/document-access.service";
import { EmitDocumentOrchestrator } from "../src/infrastructure/documents/emit-document.orchestrator";
import { EmitInvoiceUseCase } from "../src/infrastructure/documents/emit-invoice.use-case";
import type { CredentialsResolver } from "../src/infrastructure/documents/credentials-resolver";
import { SeriesService } from "../src/infrastructure/series/series.service";
import { ObjectStorageService } from "../src/infrastructure/storage/object-storage.service";
import { PdfService } from "../src/infrastructure/pdf/pdf.service";
import {
  EmailService,
  EmailDeliveryError,
} from "../src/infrastructure/notifications/email.service";
import { AuditService } from "../src/infrastructure/audit/audit.service";
import type { QueueProducer } from "../src/infrastructure/queues/queue.producer";
import type { QueueJobData } from "../src/infrastructure/queues/queue.tokens";
import { envSchema, type Env } from "../src/infrastructure/config/env.schema";
import { IntegratorCompaniesController } from "../src/interfaces/http/companies/integrator-companies.controller";
import {
  DocumentIntegrationController,
  SharedDocumentsController,
} from "../src/interfaces/http/v1/document-integration.controller";
import { DocumentsController } from "../src/interfaces/http/v1/documents.controller";
import { CapabilitiesController } from "../src/interfaces/http/v1/capabilities.controller";
import { ApiKeyGuard } from "../src/interfaces/http/guards/api-key.guard";
import { AppExceptionFilter } from "../src/interfaces/http/filters/app-exception.filter";
import type { ApiKeyService } from "../src/infrastructure/api-keys/api-key.service";
import type { RateLimitService } from "../src/infrastructure/redis/rate-limit.service";
import type { AuthService } from "../src/infrastructure/auth/auth.service";
import { invoiceCreateSchema } from "../src/interfaces/http/dto/invoice-create.schema";
import { enrichInvoicingRequestBodies } from "../src/infrastructure/openapi/enrich-invoicing-bodies";

describe("phase 4 isolated onboarding, recovery, delivery and recipient access", () => {
  const org = newId();
  let companyId: string, productionCompany: string;
  let db: Db,
    app: INestApplication,
    s3: S3Client,
    storage: ObjectStorageService,
    docs: DocumentsService,
    email: EmailService,
    delivery: DocumentDeliveryService,
    recovery: CdrRecoveryService,
    invoice: EmitInvoiceUseCase,
    vault: CredentialsVault,
    pdf: PdfService;
  const enqueue = vi.fn().mockResolvedValue({ jobId: "fixture" });
  const encryptedKeys = new Set<string>();
  const allScopes = [
    "companies:read",
    "companies:write",
    "credentials:manage",
    "series:read",
    "series:write",
    "documents:read",
    "documents:write",
    "documents:deliver",
    "documents:share",
  ];
  beforeAll(async () => {
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
    );
    await db.insert(organizations).values({ id: org, name: "Phase 4 test", slug: "phase4-" + org });
    const config = new ConfigService<Env, true>(
      envSchema.parse({
        NODE_ENV: "test",
        SUNAT_BILL_MODE: "fake",
        EMAIL_DRIVER: "log",
        PDF_RI_MODE: "fake",
      }),
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
    const companyService = new CompaniesService(db),
      series = new SeriesService(db, companyService);
    docs = new DocumentsService(db, storage);
    vault = new CredentialsVault(storage, config);
    const credentialService = new CredentialsService(db, companyService, vault);
    const cert = generateTestPfx("phase4-fixture");
    const resolver = {
      resolveCertificate: async () => ({ pfx: cert.pfx, password: "phase4-fixture" }),
      resolveSol: async () => ({ username: "20100070970MODDATOS", password: "fixture-only" }),
    } as unknown as CredentialsResolver;
    const queues = { enqueue } as unknown as QueueProducer;
    pdf = new PdfService(
      docs,
      companyService,
      queues,
      config,
      new CompanyLogoService(db, companyService, storage),
    );
    invoice = new EmitInvoiceUseCase(
      new EmitDocumentOrchestrator(db, companyService, series, docs, resolver, queues),
    );
    email = new EmailService(config);
    delivery = new DocumentDeliveryService(db, docs, pdf, email, queues);
    recovery = new CdrRecoveryService(db, docs, resolver, companyService, queues, config);
    const access = new DocumentAccessService(db, docs, pdf);
    const module = await Test.createTestingModule({
      controllers: [
        IntegratorCompaniesController,
        DocumentIntegrationController,
        SharedDocumentsController,
        DocumentsController,
        CapabilitiesController,
      ],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: CompaniesService, useValue: companyService },
        { provide: SeriesService, useValue: series },
        { provide: CredentialsService, useValue: credentialService },
        { provide: AuditService, useValue: new AuditService(db) },
        { provide: DocumentsService, useValue: docs },
        { provide: PdfService, useValue: pdf },
        { provide: CdrRecoveryService, useValue: recovery },
        { provide: DocumentAccessService, useValue: access },
        { provide: DocumentDeliveryService, useValue: delivery },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(
      new ApiKeyGuard(
        new Reflector(),
        {
          authenticate: async (secret: string) => {
            if (!["admin", "reader", "foreign", "sandbox"].includes(secret))
              throw AppError.unauthorized();
            return {
              kind: "api_key",
              organizationId: secret === "foreign" ? newId() : org,
              apiKeyId: "phase4-fixture",
              scopes: secret === "reader" ? ["documents:read", "companies:read"] : allScopes,
              environmentConstraint: secret === "sandbox" ? "sandbox" : null,
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
    companyId = (
      await api("post", "/v1/companies")
        .send({ ruc: "20100070970", legal_name: "Fixture only", environment: "sandbox" })
        .expect(201)
    ).body.id;
    productionCompany = newId();
    await db.insert(companies).values({
      id: productionCompany,
      organizationId: org,
      ruc: "20601234567",
      legalName: "Environment fixture",
      environment: "production",
      address: {},
    });
  });
  afterAll(async () => {
    await app?.close();
    if (db) {
      for (const c of await db
        .select()
        .from(credentials)
        .where(eq(credentials.organizationId, org)))
        encryptedKeys.add(vault.parseSecretRef(c.secretRef).key);
      for (const a of await db
        .select()
        .from(documentArtifacts)
        .where(eq(documentArtifacts.organizationId, org)))
        if (a.objectKey) await storage.deleteObject(a.objectKey);
      for (const key of encryptedKeys) await storage.deleteObject(key);
      await db.delete(auditEvents).where(eq(auditEvents.organizationId, org));
      await db.delete(organizations).where(eq(organizations.id, org));
      await db.$client.end();
    }
    s3?.destroy();
  });
  function api(method: "get" | "post" | "put" | "patch" | "delete", path: string, key = "admin") {
    return request(app.getHttpServer())[method](path).auth(key, { type: "bearer" });
  }
  async function makeDoc(status = "accepted") {
    const doc = await invoice.execute({
      organizationId: org,
      idempotencyKey: newId(),
      body: invoiceCreateSchema.parse({ ...phase1Request(), company_id: companyId }),
    });
    await db.update(documents).set({ status }).where(eq(documents.id, doc.id));
    return doc.id;
  }
  function job(id: string, deliveryId: string, attemptsMade = 0) {
    return {
      data: { organizationId: org, companyId, documentId: id, deliveryId },
      opts: { attempts: 5 },
      attemptsMade,
    } as Job<QueueJobData>;
  }
  it("isolates onboarding and environment-constrained keys; preserves series numbers and history", async () => {
    await api("get", `/v1/companies/${companyId}`, "foreign").expect(404);
    await api("put", `/v1/companies/${companyId}/sol-credentials`, "reader")
      .send({ username: "20100070970MODDATOS", password: "fixture-only" })
      .expect(403);
    await api("get", `/v1/companies/${productionCompany}`, "sandbox").expect(403);
    const list = (await api("get", "/v1/companies", "sandbox").expect(200)).body;
    expect(list.map((r: { id: string }) => r.id)).toEqual([companyId]);
    await api("patch", `/v1/companies/${companyId}`, "sandbox")
      .send({ environment: "production" })
      .expect(403);
    const series = (
      await api("post", `/v1/companies/${companyId}/series`)
        .send({ document_type: "01", serie: "F004" })
        .expect(201)
    ).body;
    await api("patch", `/v1/companies/${companyId}/series/${series.id}`)
      .send({ next_number: 1 })
      .expect(422);
    await api("patch", `/v1/companies/${companyId}/series/${series.id}`)
      .send({ is_active: false })
      .expect(200);
    await api("delete", `/v1/companies/${companyId}`).expect(404);
  });
  it("rotates encrypted credentials atomically and returns no secret, then revokes", async () => {
    for (const password of ["first-fixture-secret", "second-fixture-secret"]) {
      await api("put", `/v1/companies/${companyId}/sol-credentials`)
        .send({ username: "20100070970MODDATOS", password })
        .expect(204);
      const [row] = await db.select().from(credentials).where(eq(credentials.companyId, companyId));
      if (!row) throw new Error("Missing credential");
      encryptedKeys.add(vault.parseSecretRef(row.secretRef).key);
      const blob = await storage.getObject(vault.parseSecretRef(row.secretRef).key);
      expect(blob.toString()).not.toContain(password);
      expect(vault.decryptJson<{ password: string }>(blob).password).toBe(password);
      expect(JSON.stringify((await api("get", `/v1/companies/${companyId}`)).body)).not.toContain(
        password,
      );
    }
    expect(encryptedKeys.size).toBe(2);
    await api("put", `/v1/companies/${companyId}/sol-credentials`)
      .send({ username: "20601234567MODDATOS", password: "fixture" })
      .expect(422);
    await api("delete", `/v1/companies/${companyId}/credentials/sol`).expect(204);
    const [row] = await db.select().from(credentials).where(eq(credentials.companyId, companyId));
    expect(row?.status).toBe("revoked");
    const audit = await db.select().from(auditEvents).where(eq(auditEvents.organizationId, org));
    expect(audit.some((a) => a.action === "company.sol_rotated")).toBe(true);
    expect(JSON.stringify(audit)).not.toContain("first-fixture-secret");
  });
  it("returns useful artifact, hash, observations and zero-padding tolerant identifier filters", async () => {
    const id = await makeDoc();
    await docs.patchPayload(id, { _sunat: { observations: ["4000 - fixture"] } });
    const detail = (await api("get", `/v1/documents/${id}`).expect(200)).body;
    expect(detail.artifacts.xml_signed.status).toBe("available");
    expect(detail.qr.digest).toBeTruthy();
    expect(detail.observations).toEqual(["4000 - fixture"]);
    expect(detail.collection_status).toBe("not_managed");
    const rows = (
      await api(
        "get",
        `/v1/documents?company_id=${companyId}&document_type=01&serie_number=F001-1`,
      ).expect(200)
    ).body.items;
    expect(rows.some((r: { id: string }) => r.id === id)).toBe(true);
  });
  it("recovers CDR without new issuance, correlatives or repeated consultation after success", async () => {
    const id = await makeDoc("failed");
    const before = await db
      .select()
      .from(documentSeries)
      .where(eq(documentSeries.companyId, companyId));
    const queuedBefore = enqueue.mock.calls.length;
    const result = (await api("post", `/v1/documents/${id}/recover-cdr`).expect(201)).body;
    expect(result.status).toBe("accepted");
    expect(result.reconciliation).toMatchObject({
      state: "recovered",
      attempts: 1,
      simulated: true,
    });
    expect(result.artifacts.cdr_xml.status).toBe("available");
    await api("post", `/v1/documents/${id}/recover-cdr`).expect(201);
    expect((await docs.getById(org, id)).payload).toHaveProperty("_reconciliation.attempts", 1);
    expect(
      await db.select().from(documentSeries).where(eq(documentSeries.companyId, companyId)),
    ).toEqual(before);
    expect(enqueue.mock.calls.length).toBe(queuedBefore);
    await api("post", `/v1/documents/${id}/recover-cdr`, "foreign").expect(404);
  });
  it("reuses summary tickets and recovers missing CDR on already accepted summaries without reemission", async () => {
    const id = await makeDoc("failed");
    await db
      .update(documents)
      .set({ documentType: "RC", serieNumber: "RC-20261008-1", sunatTicket: "existing-ticket" })
      .where(eq(documents.id, id));
    enqueue.mockClear();
    const pending = await recovery.recover(org, id);
    expect(pending.status).toBe("ticket_pending");
    expect(enqueue.mock.calls).toHaveLength(1);
    expect(enqueue.mock.calls[0]?.[0]).toBe("sunat-poll");
    expect((await docs.getById(org, id)).sunatTicket).toBe("existing-ticket");
    await db.update(documents).set({ status: "accepted" }).where(eq(documents.id, id));
    const recovered = await recovery.recover(org, id);
    expect(recovered.reconciliation).toMatchObject({ attempts: 2, state: "recovered" });
    expect(recovered.artifacts.cdr_xml.status).toBe("available");
    expect(enqueue.mock.calls).toHaveLength(1);
  });
  it("deduplicates concurrent delivery requests, recipients and jobs without changing fiscal state", async () => {
    const id = await makeDoc("accepted_with_observation");
    const recipient = "fixture@example.invalid";
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        api("post", `/v1/documents/${id}/deliveries`)
          .set("Idempotency-Key", "same-event")
          .send({ recipients: [recipient, recipient.toUpperCase()] })
          .expect(201),
      ),
    );
    const deliveryId = responses[0]?.body[0]?.id;
    expect(deliveryId).toBeTruthy();
    expect(
      await db.select().from(documentDeliveries).where(eq(documentDeliveries.documentId, id)),
    ).toHaveLength(1);
    const sends = vi.spyOn(email, "send");
    await Promise.all([
      delivery.process(job(id, deliveryId)),
      delivery.process(job(id, deliveryId)),
    ]);
    expect(sends).toHaveBeenCalledTimes(1);
    expect(sends.mock.calls[0]?.[0].attachments).toHaveLength(2);
    expect((await delivery.list(org, id))[0]?.status).toBe("sent");
    expect((await docs.getById(org, id)).status).toBe("accepted_with_observation");
    await api("post", `/v1/documents/${id}/deliveries`)
      .set("Idempotency-Key", "same-event")
      .send({ recipients: ["other@example.invalid"] })
      .expect(409);
    sends.mockRestore();
  });
  it("rejects mismatched CDR identities and bounds unsuccessful recovery to three consultations", async () => {
    await db
      .update(companies)
      .set({ environment: "production" })
      .where(eq(companies.id, companyId));
    try {
      const id = await makeDoc("failed");
      const config = new ConfigService<Env, true>(
        envSchema.parse({ NODE_ENV: "test", SUNAT_BILL_MODE: "beta" }),
      );
      const service = new CdrRecoveryService(
        db,
        docs,
        {
          resolveSol: async () => ({ username: "20100070970MODDATOS", password: "test-only" }),
        } as CredentialsResolver,
        new CompaniesService(db),
        { enqueue } as unknown as QueueProducer,
        config,
      );
      const row = await docs.getById(org, id);
      const consult = vi
        .fn()
        .mockResolvedValueOnce({
          statusCode: "0001",
          rawCdrZip: buildCdrZipFixture("accepted", { documentReferenceId: row.serieNumber ?? "" }),
        })
        .mockResolvedValueOnce({ statusCode: "0011" })
        .mockRejectedValueOnce(new Error("Mock transport failure"));
      Object.assign(service, { consult: { getStatusCdr: consult } });
      await expect(service.recover(org, id)).rejects.toThrow("different document or issuer");
      expect((await docs.getById(org, id)).status).toBe("failed");
      expect((await service.recover(org, id)).reconciliation).toMatchObject({
        state: "pending",
        attempts: 2,
      });
      await expect(service.recover(org, id)).rejects.toThrow("Mock transport failure");
      await expect(service.recover(org, id)).rejects.toThrow("limit reached");
      expect(consult).toHaveBeenCalledTimes(3);
    } finally {
      await db.update(companies).set({ environment: "sandbox" }).where(eq(companies.id, companyId));
    }
  });
  it("prevents a stale preparing worker from submitting after its lease was recovered", async () => {
    const id = await makeDoc(),
      entry = (await delivery.request(org, id, "stale-worker", ["fixture@example.invalid"]))[0];
    if (!entry) throw new Error("Missing delivery");
    let unblock: () => void = () => undefined,
      entered: () => void = () => undefined;
    const pause = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const render = pdf.getOrRender.bind(pdf),
      sends = vi.spyOn(email, "send");
    const pdfSpy = vi.spyOn(pdf, "getOrRender").mockImplementationOnce(async (...args) => {
      entered();
      await pause;
      return render(...args);
    });
    const original = delivery.process(job(id, entry.id));
    await started;
    await db
      .update(documentDeliveries)
      .set({ updatedAt: new Date(Date.now() - 360000) })
      .where(eq(documentDeliveries.id, entry.id));
    await delivery.sweep();
    unblock();
    await original;
    expect(sends).not.toHaveBeenCalled();
    expect((await delivery.list(org, id))[0]?.status).toBe("queued");
    await delivery.process(job(id, entry.id));
    expect(sends).toHaveBeenCalledTimes(1);
    pdfSpy.mockRestore();
    sends.mockRestore();
  });
  it("waits for acceptance, wakes persisted requests, expires pending delivery and blocks cancelled docs", async () => {
    const id = await makeDoc("sent");
    const result = (
      await api("post", `/v1/documents/${id}/deliveries`)
        .set("Idempotency-Key", "wait")
        .send({ recipients: ["fixture@example.invalid"] })
        .expect(201)
    ).body[0];
    expect(result.status).toBe("waiting");
    await db.update(documents).set({ status: "accepted" }).where(eq(documents.id, id));
    await delivery.sweep();
    expect((await delivery.list(org, id))[0]?.status).toBe("queued");
    await db.update(documents).set({ status: "cancelled" }).where(eq(documents.id, id));
    await delivery.process(job(id, result.id));
    expect((await delivery.list(org, id))[0]?.status).toBe("failed");
    await api("post", `/v1/documents/${id}/deliveries`)
      .set("Idempotency-Key", "cancelled")
      .send({ recipients: ["fixture@example.invalid"] })
      .expect(409);
    const waiting = await makeDoc("sent");
    const entry = (await delivery.request(org, waiting, "expires", ["fixture@example.invalid"]))[0];
    if (!entry) throw new Error("Missing delivery");
    await db
      .update(documentDeliveries)
      .set({ expiresAt: new Date(0) })
      .where(eq(documentDeliveries.id, entry.id));
    await delivery.sweep();
    expect((await delivery.list(org, waiting))[0]?.status).toBe("expired");
  });
  it("retries safe provider rejection but retains ambiguous submission for explicit review", async () => {
    const id = await makeDoc();
    const entry = (await delivery.request(org, id, "safe-failure", ["fixture@example.invalid"]))[0];
    if (!entry) throw new Error("Missing delivery");
    const sends = vi.spyOn(email, "send");
    sends.mockRejectedValueOnce(new EmailDeliveryError("SMTP rejected", true));
    await expect(delivery.process(job(id, entry.id))).rejects.toThrow();
    expect((await delivery.list(org, id))[0]?.status).toBe("retrying");
    sends.mockRejectedValueOnce(new Error("Timeout after DATA"));
    await delivery.process(job(id, entry.id, 1));
    expect((await delivery.list(org, id))[0]?.status).toBe("unknown");
    await delivery.process(job(id, entry.id, 2));
    expect(sends).toHaveBeenCalledTimes(2);
    await api("post", `/v1/documents/${id}/deliveries/${entry.id}/retry`, "reader")
      .send({ reason: "Operator confirms retry" })
      .expect(403);
    await api("post", `/v1/documents/${id}/deliveries/${entry.id}/retry`)
      .send({ reason: "Operator confirms retry" })
      .expect(201);
    await delivery.process(job(id, entry.id));
    expect((await delivery.list(org, id))[0]?.status).toBe("sent");
    expect((await docs.getById(org, id)).status).toBe("accepted");
    sends.mockRestore();
  });
  it("limits shared access to one document and allowed artifacts; expiry/revocation apply to downloads", async () => {
    const id = await makeDoc();
    const share = (
      await api("post", `/v1/documents/${id}/shares`)
        .send({ allowed_artifacts: ["xml"], ttl_seconds: 3600 })
        .expect(201)
    ).body;
    const metadata = (await request(app.getHttpServer()).get(share.url).expect(200)).body;
    expect(metadata).not.toHaveProperty("customer");
    expect(metadata).not.toHaveProperty("organization_id");
    const xml = await request(app.getHttpServer())
      .get(share.url + "/xml")
      .expect(200);
    expect(xml.headers["cache-control"]).toBe("no-store");
    await request(app.getHttpServer())
      .get(share.url + "/pdf")
      .expect(404);
    await api("delete", `/v1/documents/${id}/shares/${share.id}`, "foreign").expect(404);
    const [stored] = await db.select().from(documentShares).where(eq(documentShares.id, share.id));
    expect(stored?.tokenHash).not.toContain(share.url.split("/").at(-1));
    expect(JSON.stringify((await api("get", `/v1/documents/${id}/shares`)).body)).not.toContain(
      share.url,
    );
    await api("delete", `/v1/documents/${id}/shares/${share.id}`).expect(204);
    await request(app.getHttpServer())
      .get(share.url + "/xml")
      .expect(404);
    const expired = (
      await api("post", `/v1/documents/${id}/shares`).send({
        allowed_artifacts: ["xml"],
        ttl_seconds: 60,
      })
    ).body;
    await db
      .update(documentShares)
      .set({ expiresAt: new Date(0) })
      .where(eq(documentShares.id, expired.id));
    await request(app.getHttpServer()).get(expired.url).expect(404);
  });
  it("shares pending status but cannot deliver recipient files before acceptance", async () => {
    const id = await makeDoc("sent");
    const share = (
      await api("post", `/v1/documents/${id}/shares`)
        .send({ allowed_artifacts: ["xml"] })
        .expect(201)
    ).body;
    await request(app.getHttpServer()).get(share.url).expect(200);
    await request(app.getHttpServer())
      .get(share.url + "/xml")
      .expect(409);
    await api("post", `/v1/documents/${id}/shares`, "reader")
      .send({ allowed_artifacts: ["xml"] })
      .expect(403);
  });
  it("publishes schemas and explicit unsupported capabilities", async () => {
    const spec = enrichInvoicingRequestBodies(
      SwaggerModule.createDocument(app, new DocumentBuilder().build()),
    );
    for (const route of [
      "/v1/documents/{id}/deliveries",
      "/v1/documents/{id}/shares",
      "/v1/companies",
    ])
      expect(spec.paths[route]?.post?.requestBody).toBeTruthy();
    const result = (await request(app.getHttpServer()).get("/v1/capabilities").expect(200)).body;
    expect(result.unsupported).toContain("GRE_void_REST");
    expect(result.modes.email).toBe("log");
  });
});
