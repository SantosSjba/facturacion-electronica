import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { generateTestPfx } from "@factosys/sunat-sign";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { App } from "supertest/types";

import { E2eAppModule } from "./e2e-app.module";

describe("API e2e", () => {
  let app: INestApplication;
  let server: App;
  let accessToken: string;
  let apiKeySecret: string;
  let companyId: string;

  beforeAll(async () => {
    process.env["NODE_ENV"] = "test";
    process.env["LOG_LEVEL"] = "silent";
    process.env["JWT_ACCESS_SECRET"] =
      process.env["JWT_ACCESS_SECRET"] ?? "test-jwt-access-secret-32bytes!!";
    process.env["RATE_LIMIT_RPM_DEFAULT"] = "5000";
    process.env["CREDENTIALS_MASTER_KEY"] =
      process.env["CREDENTIALS_MASTER_KEY"] ??
      Buffer.alloc(32, 7).toString("base64");
    process.env["SUNAT_BILL_MODE"] = "fake";
    process.env["SUNAT_GRE_MODE"] = "fake";
    process.env["PDF_RI_MODE"] = "fake";
    process.env["SUNAT_VALIDEZ_MODE"] = "fake";
    process.env["WEBHOOK_ALLOW_LOCALHOST"] = "1";

    const moduleRef = await Test.createTestingModule({
      imports: [E2eAppModule],
    }).compile();

    app = moduleRef.createNestApplication({
      bufferLogs: true,
      logger: false,
    });
    await app.init();
    server = app.getHttpServer() as App;

    const login = await request(server)
      .post("/auth/login")
      .send({
        email: "owner@demo.local",
        password: "DemoOwner!2026",
        organization_slug: "demo",
      });
    expect(login.status).toBe(200);
    accessToken = login.body.access_token as string;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /health returns 200 JSON", async () => {
    const res = await request(server).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("GET /ready returns 200 when database and redis are up", async () => {
    const res = await request(server).get("/ready").expect(200);
    expect(res.body).toEqual({
      status: "ok",
      checks: { database: "up", redis: "up" },
    });
  });

  it("maps AppError to OpenAPI Error shape with request_id", async () => {
    const res = await request(server)
      .get("/__test/app-error")
      .set("x-request-id", "11111111-1111-1111-1111-111111111111")
      .expect(400);

    expect(res.body).toMatchObject({
      code: "FACTOSYS_VALIDATION",
      message: "Probe validation error",
      stage: "request",
      request_id: "11111111-1111-1111-1111-111111111111",
      details: [{ path: "field", issue: "invalid" }],
    });
    expect(res.headers["x-request-id"]).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("creates API key once and authenticates /v1/whoami", async () => {
    const created = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "e2e-key",
        scopes: ["documents:read", "documents:write"],
      })
      .expect(201);

    expect(created.body.secret).toMatch(/^fsys_/);
    apiKeySecret = created.body.secret as string;

    const whoami = await request(server)
      .get("/v1/whoami")
      .set("Authorization", `Bearer ${apiKeySecret}`)
      .expect(200);
    expect(whoami.body.scopes).toContain("documents:read");

    await request(server)
      .get("/v1/whoami")
      .set("Authorization", "Bearer fsys_invalid")
      .expect(401);
  });

  it("returns 403 when API key lacks required scope", async () => {
    const created = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "e2e-readonly",
        scopes: ["documents:read"],
      })
      .expect(201);

    await request(server)
      .get("/v1/whoami/documents-write")
      .set("Authorization", `Bearer ${created.body.secret}`)
      .expect(403);
  });

  it("lists users and forbids viewer from users:write", async () => {
    const list = await request(server)
      .get("/organizations/me/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    const viewer = await request(server)
      .post("/organizations/me/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: `viewer-${Date.now()}@demo.local`,
        name: "Viewer",
        password: "ViewerPass1!",
        roles: ["viewer"],
      })
      .expect(201);

    const loginViewer = await request(server)
      .post("/auth/login")
      .send({
        email: viewer.body.email,
        password: "ViewerPass1!",
        organization_slug: "demo",
      })
      .expect(200);

    await request(server)
      .post("/organizations/me/users")
      .set("Authorization", `Bearer ${loginViewer.body.access_token}`)
      .send({
        email: `blocked-${Date.now()}@demo.local`,
        name: "Blocked",
        password: "BlockedPass1!",
        roles: ["viewer"],
      })
      .expect(403);
  });

  it("CRUD company + credentials + series allocate without duplicates", async () => {
    const suffix = String(Date.now()).slice(-6);
    // Build unique valid-ish RUC: use known valid base and accept conflict retry
    const created = await request(server)
      .post("/companies")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ruc: "20100070970",
        legal_name: `E2E Co ${suffix}`,
        environment: "sandbox",
      });

    if (created.status === 409) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const found = (list.body as { ruc: string; id: string }[]).find(
        (c) => c.ruc === "20100070970",
      );
      expect(found).toBeTruthy();
      if (!found) throw new Error("company missing after conflict");
      companyId = found.id;
    } else {
      expect(created.status).toBe(201);
      companyId = created.body.id as string;
      expect(created.body.certificate_status).toBe("missing");
      expect(created.body.sol_configured).toBe(false);
    }

    const prod = await request(server)
      .post("/companies")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ruc: "20100070970",
        legal_name: `E2E Co Prod ${suffix}`,
        environment: "production",
      });
    expect([201, 409]).toContain(prod.status);

    const password = "TestPfx1!";
    const { pfx } = generateTestPfx(password);
    await request(server)
      .put(`/companies/${companyId}/certificate`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pfx, "test.pfx")
      .field("password", password)
      .expect(204);

    await request(server)
      .put(`/companies/${companyId}/sol-credentials`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: "20100070970MODDATOS", password: "sol-secret" })
      .expect(204);

    await request(server)
      .put(`/companies/${companyId}/gre-credentials`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ client_id: "gre-client", client_secret: "gre-secret" })
      .expect(204);

    const got = await request(server)
      .get(`/companies/${companyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(got.body.certificate_status).toBe("active");
    expect(got.body.sol_configured).toBe(true);
    expect(got.body.gre_configured).toBe(true);
    expect(JSON.stringify(got.body)).not.toMatch(/sol-secret|gre-secret|TestPfx/);

    const serieName = `F${suffix.slice(0, 3)}`.toUpperCase();
    await request(server)
      .post(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ document_type: "01", serie: serieName, next_number: 1 })
      .expect(201);

    const allocations = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(server)
          .post(`/companies/${companyId}/series/allocate`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ document_type: "01", serie: serieName }),
      ),
    );
    const numbers = allocations.map((r) => {
      expect(r.status).toBe(201);
      return r.body.number as number;
    });
    expect(new Set(numbers).size).toBe(8);
    expect(Math.max(...numbers) - Math.min(...numbers)).toBe(7);
  });

  it("idempotency: same key+body replays; different body conflicts 409", async () => {
    let probeCompanyId = companyId;
    if (!probeCompanyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      expect(first).toBeTruthy();
      if (!first) throw new Error("no company for idempotency probe");
      probeCompanyId = first.id;
    }

    const key = `e2e-idem-${Date.now()}`;
    const body = { company_id: probeCompanyId, value: "alpha" };

    const first = await request(server)
      .post("/__test/idempotency")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send(body)
      .expect(200);
    expect(first.body.echo).toBe("processed:alpha");

    const replay = await request(server)
      .post("/__test/idempotency")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send(body)
      .expect(200);
    expect(replay.body).toEqual(first.body);

    const conflict = await request(server)
      .post("/__test/idempotency")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send({ company_id: probeCompanyId, value: "beta" })
      .expect(409);
    expect(conflict.body.code).toBe("FACTOSYS_IDEMPOTENCY_CONFLICT");
  });

  it("BullMQ pdf-render worker finishes job", async () => {
    const { QueueEvents } = await import("bullmq");
    const { QueueProducer } = await import(
      "../src/infrastructure/queues/queue.producer"
    );
    const { BULLMQ_CONNECTION } = await import(
      "../src/infrastructure/queues/queue.tokens"
    );
    const producer = app.get(QueueProducer);
    const connection = app.get(BULLMQ_CONNECTION);
    const queue = producer.getQueue("pdf-render");
    const events = new QueueEvents("pdf-render", { connection });
    await events.waitUntilReady();

    try {
      const { jobId } = await producer.enqueue("pdf-render", {
        organizationId: "00000000-0000-0000-0000-000000000001",
        companyId: "00000000-0000-0000-0000-000000000002",
        documentId: "00000000-0000-0000-0000-000000000003",
      });

      const job = await queue.getJob(jobId);
      expect(job).toBeTruthy();
      if (!job) throw new Error("job missing");
      const result = await job.waitUntilFinished(events, 15_000);
      expect(result).toEqual({ ok: true });
    } finally {
      await events.close();
    }
  });

  it("emits factura 01 via API key, worker accepts, xml/cdr downloadable", async () => {
    // Ensure company + credentials from prior CRUD test
    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    const emitKey = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `emit-${Date.now()}`,
        scopes: ["documents:read", "documents:write"],
      })
      .expect(201);
    const emitSecret = emitKey.body.secret as string;

    // Ensure F001 series exists
    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const hasF001 = (seriesList.body as { serie: string; documentType: string }[]).some(
      (s) => s.serie === "F001" && s.documentType === "01",
    );
    if (!hasF001) {
      await request(server)
        .post(`/companies/${companyId}/series`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ document_type: "01", serie: "F001", next_number: 1 })
        .expect(201);
    }

    const invoiceBody = {
      company_id: companyId,
      serie: "F001",
      operation_type: "0101",
      issue_date: "2026-09-17",
      currency: "PEN",
      totals_mode: "auto",
      customer: {
        identity_type: "6",
        identity_number: "20123456789",
        name: "ACME SAC",
      },
      lines: [
        {
          id: 1,
          quantity: 1,
          unit_code: "NIU",
          description: "Servicio de consultoría",
          unit_value: 100,
          unit_price: 118,
          tax_affectation: "10",
          igv_percent: 18,
          tax_scheme_id: "1000",
        },
      ],
    };

    const bad = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `bad-${Date.now()}`)
      .send({ company_id: companyId })
      .expect(422);
    expect(bad.body.code).toBe("FACTOSYS_VALIDATION");

    const idemKey = `inv-${Date.now()}`;
    const created = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", idemKey)
      .send(invoiceBody)
      .expect(201);
    expect(created.body.status).toBe("queued");
    expect(created.body.document_type).toBe("01");
    const documentId = created.body.id as string;

    const replay = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", idemKey)
      .send(invoiceBody)
      .expect(201);
    expect(replay.body.id).toBe(documentId);

    let status = created.body.status as string;
    for (
      let i = 0;
      i < 40 && (status === "queued" || status === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${documentId}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      status = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(status);

    const trace = await request(server)
      .get(`/v1/documents/${documentId}/trace`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(Array.isArray(trace.body)).toBe(true);
    expect(trace.body.length).toBeGreaterThan(0);

    const xml = await request(server)
      .get(`/v1/documents/${documentId}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(xml.text).toContain("Invoice");

    await request(server)
      .get(`/v1/documents/${documentId}/cdr`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
  });

  it("emits boleta 03, NC 07 and ND 08 via API (S5)", async () => {
    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    const emitKey = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `s5-${Date.now()}`,
        scopes: ["documents:read", "documents:write"],
      })
      .expect(201);
    const emitSecret = emitKey.body.secret as string;

    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const series = seriesList.body as { serie: string; documentType: string }[];
    const ensureSerie = async (documentType: string, serie: string) => {
      const has = series.some(
        (s) => s.serie === serie && s.documentType === documentType,
      );
      if (!has) {
        await request(server)
          .post(`/companies/${companyId}/series`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ document_type: documentType, serie, next_number: 1 })
          .expect(201);
      }
    };
    await ensureSerie("01", "F001");
    await ensureSerie("03", "B001");
    await ensureSerie("07", "F001");
    await ensureSerie("08", "F001");

    const receiptBody = {
      company_id: companyId,
      serie: "B001",
      operation_type: "0101",
      issue_date: "2026-09-17",
      currency: "PEN",
      totals_mode: "auto",
      include_in_daily_summary: true,
      customer: {
        identity_type: "1",
        identity_number: "12345678",
        name: "JUAN PEREZ",
      },
      lines: [
        {
          id: 1,
          quantity: 2,
          unit_code: "NIU",
          description: "Producto",
          unit_value: 50,
          unit_price: 59,
          tax_affectation: "10",
          igv_percent: 18,
          tax_scheme_id: "1000",
        },
      ],
    };

    const receipt = await request(server)
      .post("/v1/receipts")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `rcpt-${Date.now()}`)
      .send(receiptBody)
      .expect(201);
    expect(receipt.body.document_type).toBe("03");
    expect(receipt.body.summary_status).toBe("pending");

    let receiptStatus = receipt.body.status as string;
    for (
      let i = 0;
      i < 40 && (receiptStatus === "queued" || receiptStatus === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${receipt.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      receiptStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(receiptStatus);

    const receiptXml = await request(server)
      .get(`/v1/documents/${receipt.body.id}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(receiptXml.text).toContain("Invoice");
    expect(receiptXml.text).toContain(">03</cbc:InvoiceTypeCode>");

    // Invoice to attach NC/ND
    const inv = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `inv-s5-${Date.now()}`)
      .send({
        company_id: companyId,
        serie: "F001",
        operation_type: "0101",
        issue_date: "2026-09-17",
        currency: "PEN",
        totals_mode: "auto",
        customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME SAC",
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "Servicio",
            unit_value: 100,
            unit_price: 118,
            tax_affectation: "10",
            igv_percent: 18,
            tax_scheme_id: "1000",
          },
        ],
      })
      .expect(201);

    let invStatus = inv.body.status as string;
    for (
      let i = 0;
      i < 40 && (invStatus === "queued" || invStatus === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${inv.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      invStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(invStatus);
    const affectedSerie = inv.body.serie_number as string;

    const nc = await request(server)
      .post("/v1/credit-notes")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `nc-${Date.now()}`)
      .send({
        company_id: companyId,
        serie: "F001",
        issue_date: "2026-09-18",
        currency: "PEN",
        note_type: "01",
        reason: "Anulación de la operación",
        affected_document: {
          document_type: "01",
          serie_number: affectedSerie,
        },
        customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME SAC",
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "Servicio anulado",
            unit_value: 100,
            unit_price: 118,
            tax_affectation: "10",
            igv_percent: 18,
            tax_scheme_id: "1000",
          },
        ],
        totals_mode: "auto",
      })
      .expect(201);
    expect(nc.body.document_type).toBe("07");

    let ncStatus = nc.body.status as string;
    for (
      let i = 0;
      i < 40 && (ncStatus === "queued" || ncStatus === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${nc.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      ncStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(ncStatus);

    const ncXml = await request(server)
      .get(`/v1/documents/${nc.body.id}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(ncXml.text).toContain("CreditNote");

    const nd = await request(server)
      .post("/v1/debit-notes")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `nd-${Date.now()}`)
      .send({
        company_id: companyId,
        serie: "F001",
        issue_date: "2026-09-18",
        currency: "PEN",
        note_type: "01",
        reason: "Intereses por mora",
        affected_document: {
          document_type: "01",
          serie_number: affectedSerie,
        },
        customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME SAC",
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "Interés moratorio",
            unit_value: 20,
            unit_price: 23.6,
            tax_affectation: "10",
            igv_percent: 18,
            tax_scheme_id: "1000",
          },
        ],
        totals_mode: "auto",
      })
      .expect(201);
    expect(nd.body.document_type).toBe("08");

    let ndStatus = nd.body.status as string;
    for (
      let i = 0;
      i < 40 && (ndStatus === "queued" || ndStatus === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${nd.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      ndStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(ndStatus);

    const ndXml = await request(server)
      .get(`/v1/documents/${nd.body.id}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(ndXml.text).toContain("DebitNote");
  });

  it("emits RA voided-document and RC daily-summary via Fake poll (S6)", async () => {
    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    const emitKey = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `s6-${Date.now()}`,
        scopes: ["documents:read", "documents:write"],
      })
      .expect(201);
    const emitSecret = emitKey.body.secret as string;

    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const series = seriesList.body as { serie: string; documentType: string }[];
    const ensureSerie = async (documentType: string, serie: string) => {
      const has = series.some(
        (s) => s.serie === serie && s.documentType === documentType,
      );
      if (!has) {
        await request(server)
          .post(`/companies/${companyId}/series`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ document_type: documentType, serie, next_number: 1 })
          .expect(201);
      }
    };
    await ensureSerie("01", "F001");
    await ensureSerie("03", "B001");

    // Invoice → accepted → RA void
    const inv = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `inv-s6-${Date.now()}`)
      .send({
        company_id: companyId,
        serie: "F001",
        operation_type: "0101",
        issue_date: "2026-09-15",
        currency: "PEN",
        totals_mode: "auto",
        customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME SAC",
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "Servicio",
            unit_value: 100,
            unit_price: 118,
            tax_affectation: "10",
            igv_percent: 18,
            tax_scheme_id: "1000",
          },
        ],
      })
      .expect(201);

    let invStatus = inv.body.status as string;
    for (
      let i = 0;
      i < 40 && (invStatus === "queued" || invStatus === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${inv.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      invStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(invStatus);

    const badRa = await request(server)
      .post("/v1/voided-documents")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `ra-bad-${Date.now()}`)
      .send({ company_id: companyId })
      .expect(422);
    expect(badRa.body.code).toBe("FACTOSYS_VALIDATION");

    const ra = await request(server)
      .post("/v1/voided-documents")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `ra-${Date.now()}`)
      .send({
        company_id: companyId,
        reference_date: "2026-09-15",
        documents: [
          {
            document_type: "01",
            serie_number: inv.body.serie_number,
            reason: "Error en datos; comprobante no otorgado",
          },
        ],
      })
      .expect(201);
    expect(ra.body.document_type).toBe("RA");
    expect(ra.body.status).toBe("ticket_pending");
    expect(ra.body.sunat_ticket).toBeTruthy();

    let raStatus = ra.body.status as string;
    for (let i = 0; i < 40 && raStatus === "ticket_pending"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${ra.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      raStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(raStatus);

    const cancelled = await request(server)
      .get(`/v1/documents/${inv.body.id}`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(cancelled.body.status).toBe("cancelled");

    const raXml = await request(server)
      .get(`/v1/documents/${ra.body.id}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(raXml.text).toContain("VoidedDocuments");

    // Boleta → accepted → RC auto-pool
    const receipt = await request(server)
      .post("/v1/receipts")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `rcpt-s6-${Date.now()}`)
      .send({
        company_id: companyId,
        serie: "B001",
        operation_type: "0101",
        issue_date: "2026-09-17",
        currency: "PEN",
        totals_mode: "auto",
        include_in_daily_summary: true,
        customer: {
          identity_type: "1",
          identity_number: "12345678",
          name: "JUAN PEREZ",
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "Producto RC",
            unit_value: 50,
            unit_price: 59,
            tax_affectation: "10",
            igv_percent: 18,
            tax_scheme_id: "1000",
          },
        ],
      })
      .expect(201);
    expect(receipt.body.summary_status).toBe("pending");

    let receiptStatus = receipt.body.status as string;
    for (
      let i = 0;
      i < 40 && (receiptStatus === "queued" || receiptStatus === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${receipt.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      receiptStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(receiptStatus);

    const rc = await request(server)
      .post("/v1/daily-summaries")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `rc-${Date.now()}`)
      .send({
        company_id: companyId,
        reference_date: "2026-09-17",
      })
      .expect(201);
    expect(rc.body.document_type).toBe("RC");
    expect(rc.body.status).toBe("ticket_pending");
    expect(rc.body.sunat_ticket).toBeTruthy();

    let rcStatus = rc.body.status as string;
    for (let i = 0; i < 40 && rcStatus === "ticket_pending"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${rc.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      rcStatus = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(rcStatus);

    const pooled = await request(server)
      .get(`/v1/documents/${receipt.body.id}`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(pooled.body.summary_status).toBe("accepted");

    const rcXml = await request(server)
      .get(`/v1/documents/${rc.body.id}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(rcXml.text).toContain("SummaryDocuments");
  });

  it("emits GRE 09 and 31 via Fake OAuth + poll (S7)", async () => {
    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    // Ensure GRE credentials (seeded test may already have them)
    await request(server)
      .put(`/companies/${companyId}/gre-credentials`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ client_id: "gre-client-e2e", client_secret: "gre-secret-e2e" })
      .expect(204);

    const emitKey = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `s7-${Date.now()}`,
        scopes: ["documents:read", "documents:write"],
      })
      .expect(201);
    const emitSecret = emitKey.body.secret as string;

    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const series = seriesList.body as { serie: string; documentType: string }[];
    const ensureSerie = async (documentType: string, serie: string) => {
      const has = series.some(
        (s) => s.serie === serie && s.documentType === documentType,
      );
      if (!has) {
        await request(server)
          .post(`/companies/${companyId}/series`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ document_type: documentType, serie, next_number: 1 })
          .expect(201);
      }
    };
    await ensureSerie("09", "T001");
    await ensureSerie("31", "V001");

    const bad = await request(server)
      .post("/v1/despatch-advices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `gre-bad-${Date.now()}`)
      .send({ company_id: companyId })
      .expect(422);
    expect(bad.body.code).toBe("FACTOSYS_VALIDATION");

    const gre09 = await request(server)
      .post("/v1/despatch-advices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `gre09-${Date.now()}`)
      .send({
        company_id: companyId,
        document_type: "09",
        serie: "T001",
        issue_date: "2026-09-17",
        issue_time: "10:00:00",
        delivery_customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME SAC",
        },
        shipment: {
          transfer_reason_code: "01",
          transport_mode_code: "01",
          gross_weight: 10.5,
          gross_weight_unit: "KGM",
          start_date: "2026-09-17",
          carrier: {
            identity_type: "6",
            identity_number: "20600000000",
            name: "TRANSPORTE SAC",
          },
          origin: {
            ubigeo: "150101",
            address: "Av. Emisor 123, Lima",
          },
          destination: {
            ubigeo: "150122",
            address: "Av. Destino 456, Lima",
          },
        },
        lines: [
          {
            id: 1,
            quantity: 10,
            unit_code: "NIU",
            description: "Cajas de producto",
          },
        ],
      })
      .expect(201);
    expect(gre09.body.document_type).toBe("09");
    expect(gre09.body.status).toBe("ticket_pending");
    expect(gre09.body.sunat_ticket).toBeTruthy();

    let gre09Status = gre09.body.status as string;
    for (let i = 0; i < 40 && gre09Status === "ticket_pending"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${gre09.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      gre09Status = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(gre09Status);

    const gre09Xml = await request(server)
      .get(`/v1/documents/${gre09.body.id}/xml`)
      .set("Authorization", `Bearer ${emitSecret}`)
      .expect(200);
    expect(gre09Xml.text).toContain("DespatchAdvice");

    const gre31 = await request(server)
      .post("/v1/despatch-advices")
      .set("Authorization", `Bearer ${emitSecret}`)
      .set("Idempotency-Key", `gre31-${Date.now()}`)
      .send({
        company_id: companyId,
        document_type: "31",
        serie: "V001",
        issue_date: "2026-09-17",
        issue_time: "11:30:00",
        shipper: {
          identity_type: "6",
          identity_number: "20111111111",
          name: "REMITENTE COMERCIAL SAC",
        },
        delivery_customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "ACME SAC",
        },
        shipment: {
          gross_weight: 25,
          gross_weight_unit: "KGM",
          start_date: "2026-09-17",
          vehicles: [{ plate: "ABC-123" }],
          drivers: [
            {
              job_title: "Principal",
              identity_type: "1",
              identity_number: "12345678",
              name: "Juan Conductor Perez",
              license: "Q12345678",
            },
          ],
          origin: {
            ubigeo: "150101",
            address: "Almacen origen",
          },
          destination: {
            ubigeo: "040101",
            address: "Almacen destino",
          },
        },
        lines: [
          {
            id: 1,
            quantity: 25,
            unit_code: "NIU",
            description: "Mercaderia transportada",
          },
        ],
      })
      .expect(201);
    expect(gre31.body.document_type).toBe("31");
    expect(gre31.body.status).toBe("ticket_pending");

    let gre31Status = gre31.body.status as string;
    for (let i = 0; i < 40 && gre31Status === "ticket_pending"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${gre31.body.id}`)
        .set("Authorization", `Bearer ${emitSecret}`)
        .expect(200);
      gre31Status = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(gre31Status);
  });

  it("S8: webhooks CRUD+rotate, signed delivery, PDF GET, validez CPE cache", async () => {
    process.env["PDF_RI_MODE"] = "fake";
    process.env["SUNAT_VALIDEZ_MODE"] = "fake";

    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    const http = await import("node:http");
    const received: {
      headers: http.IncomingHttpHeaders;
      body: string;
    }[] = [];

    const receiver = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        received.push({
          headers: req.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
    const addr = receiver.address();
    if (!addr || typeof addr === "string") {
      throw new Error("receiver port missing");
    }
    const webhookUrl = `https://127.0.0.1:${addr.port}/hook`;

    // SSRF allows localhost only in test; use http via temporary override of assert
    // Delivery processor uses https-only — spin HTTPS is heavy; call fanout via http by
    // patching URL check: create endpoint with https URL that we can't hit.
    // Instead: create endpoint pointing to https://example.com and verify CRUD/rotate,
    // then deliver via direct processor against a local http server by temporarily
    // writing endpoint URL to http after create (DB update).
    receiver.close();

    const s8Key = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `s8-${Date.now()}`,
        scopes: [
          "documents:read",
          "documents:write",
          "webhooks:manage",
          "validations:cpe",
        ],
      })
      .expect(201);
    const secret = s8Key.body.secret as string;

    const createdHook = await request(server)
      .post("/v1/webhook-endpoints")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        url: "https://127.0.0.1:9443/factosys-webhook",
        events: ["document.status_changed"],
      })
      .expect(201);
    expect(createdHook.body.secret).toMatch(/^whsec_/);
    expect(createdHook.body.secret_hint).toHaveLength(4);
    const endpointId = createdHook.body.id as string;
    const webhookSecret = createdHook.body.secret as string;

    const listed = await request(server)
      .get("/v1/webhook-endpoints")
      .set("Authorization", `Bearer ${secret}`)
      .expect(200);
    expect(Array.isArray(listed.body)).toBe(true);
    expect(
      (listed.body as { id: string; secret?: string }[]).some(
        (e) => e.id === endpointId && e.secret === undefined,
      ),
    ).toBe(true);

    const rotated = await request(server)
      .post(`/v1/webhook-endpoints/${endpointId}/rotate-secret`)
      .set("Authorization", `Bearer ${secret}`)
      .expect(200);
    expect(rotated.body.secret).toMatch(/^whsec_/);
    expect(rotated.body.secret).not.toBe(webhookSecret);

    // Local HTTP receiver for signed delivery (update URL in DB bypassing https create rule)
    const received2: { headers: http.IncomingHttpHeaders; body: string }[] = [];
    const receiver2 = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        received2.push({
          headers: req.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(200);
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) =>
      receiver2.listen(0, "127.0.0.1", resolve),
    );
    const addr2 = receiver2.address();
    if (!addr2 || typeof addr2 === "string") throw new Error("no port");
    const localUrl = `http://127.0.0.1:${addr2.port}/hook`;

    const { DB } = await import("../src/infrastructure/persistence/db.tokens");
    const { webhookEndpoints } = await import("@factosys/db");
    const { eq } = await import("drizzle-orm");
    const db = app.get(DB);
    await db
      .update(webhookEndpoints)
      .set({ url: localUrl })
      .where(eq(webhookEndpoints.id, endpointId));

    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const hasF001 = (
      seriesList.body as { serie: string; documentType: string }[]
    ).some((s) => s.serie === "F001" && s.documentType === "01");
    if (!hasF001) {
      await request(server)
        .post(`/companies/${companyId}/series`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ document_type: "01", serie: "F001", next_number: 1 })
        .expect(201);
    }

    const invoiceBody = {
      company_id: companyId,
      serie: "F001",
      operation_type: "0101",
      issue_date: "2026-09-17",
      currency: "PEN",
      totals_mode: "auto",
      customer: {
        identity_type: "6",
        identity_number: "20123456789",
        name: "ACME SAC",
      },
      lines: [
        {
          id: 1,
          quantity: 1,
          unit_code: "NIU",
          description: "S8 PDF/Webhook item",
          unit_value: 100,
          unit_price: 118,
          tax_affectation: "10",
          igv_percent: 18,
          tax_scheme_id: "1000",
        },
      ],
    };

    const created = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${secret}`)
      .set("Idempotency-Key", `s8-inv-${Date.now()}`)
      .send(invoiceBody)
      .expect(201);
    const documentId = created.body.id as string;

    let status = created.body.status as string;
    for (
      let i = 0;
      i < 40 && (status === "queued" || status === "sent");
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${documentId}`)
        .set("Authorization", `Bearer ${secret}`)
        .expect(200);
      status = got.body.status as string;
    }
    expect(["accepted", "accepted_with_observation"]).toContain(status);

    // Wait for webhook deliveries
    for (let i = 0; i < 40 && received2.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(received2.length).toBeGreaterThan(0);
    const delivery = received2[0]!;
    expect(delivery.headers["x-factosys-event"]).toBe("document.status_changed");
    expect(delivery.headers["x-factosys-signature"]).toMatch(/^v1=/);
    const { verifyWebhookSignature } = await import(
      "../src/infrastructure/webhooks/hmac-sign"
    );
    const ts = Number(delivery.headers["x-factosys-timestamp"]);
    expect(
      verifyWebhookSignature(
        rotated.body.secret as string,
        ts,
        delivery.body,
        String(delivery.headers["x-factosys-signature"]),
      ),
    ).toBe(true);
    receiver2.close();

    const pdf = await request(server)
      .get(`/v1/documents/${documentId}/pdf`)
      .set("Authorization", `Bearer ${secret}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(chunk as Buffer));
        res.on("end", () => {
          callback(null, Buffer.concat(data));
        });
      })
      .expect(200);
    expect(String(pdf.headers["content-type"])).toMatch(/pdf/);
    const pdfBuf = pdf.body as Buffer;
    expect(pdfBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const uniqueNumber = `accepted-${Date.now()}`;
    const val1 = await request(server)
      .post("/v1/validations/cpe")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        company_id: companyId,
        ruc: "20123456789",
        document_type: "01",
        serie: "F001",
        number: uniqueNumber,
        issue_date: "2026-09-17",
        total_amount: 118.0,
      })
      .expect(200);
    expect(val1.body.cpe_status_label).toBe("ACEPTADO");
    expect(val1.body.cached).toBe(false);
    expect(val1.body.raw.fixture).toBe("validation-cpe-accepted");

    const val2 = await request(server)
      .post("/v1/validations/cpe")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        company_id: companyId,
        ruc: "20123456789",
        document_type: "01",
        serie: "F001",
        number: uniqueNumber,
        issue_date: "2026-09-17",
        total_amount: 118.0,
      })
      .expect(200);
    expect(val2.body.cached).toBe(true);
  });

  it("S9: GET /meta/ruleset is public and returns pinned ruleset", async () => {
    const res = await request(server).get("/meta/ruleset").expect(200);
    expect(res.body.ruleset_version).toBe("2026-08-26");
    expect(res.body.source_sha256).toBeTruthy();
    expect(res.body.default_for.sandbox.ruleset).toBe("2026-08-26");
    expect(res.body.supported.ruleset).toContain("2026-08-26");
  });

  it("S9: typed AppErrorCode matrix is stable for integrators", async () => {
    const cases: {
      code: string;
      status: number;
      retryable?: boolean;
    }[] = [
      { code: "FACTOSYS_VALIDATION", status: 400, retryable: false },
      { code: "FACTOSYS_UNAUTHORIZED", status: 401 },
      { code: "FACTOSYS_FORBIDDEN", status: 403 },
      { code: "FACTOSYS_NOT_FOUND", status: 404 },
      { code: "FACTOSYS_CONFLICT", status: 409 },
      { code: "FACTOSYS_IDEMPOTENCY_CONFLICT", status: 409 },
      { code: "FACTOSYS_RATE_LIMITED", status: 429, retryable: true },
      { code: "FACTOSYS_SUNAT_REJECTED", status: 422, retryable: false },
      { code: "FACTOSYS_HTTP", status: 502, retryable: true },
      { code: "FACTOSYS_INTERNAL", status: 500, retryable: true },
    ];

    for (const [i, c] of cases.entries()) {
      const rid = `aaaaaaaa-bbbb-cccc-dddd-${String(i).padStart(12, "0")}`;
      const res = await request(server)
        .get(`/__test/errors/${c.code}`)
        .set("x-request-id", rid)
        .expect(c.status);
      expect(res.body.code).toBe(c.code);
      expect(res.body.request_id).toBe(rid);
      if (c.retryable !== undefined) {
        expect(res.body.retryable).toBe(c.retryable);
      }
    }
  });

  it("JWT owner can list documents and emit invoice (S11-DOC dual auth)", async () => {
    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const hasF001 = (
      seriesList.body as { serie: string; documentType: string }[]
    ).some((s) => s.serie === "F001" && s.documentType === "01");
    if (!hasF001) {
      await request(server)
        .post(`/companies/${companyId}/series`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ document_type: "01", serie: "F001", next_number: 1 })
        .expect(201);
    }

    const listed = await request(server)
      .get("/v1/documents")
      .query({ company_id: companyId, limit: 10 })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
    expect(listed.body).toHaveProperty("next_cursor");

    const invoiceBody = {
      company_id: companyId,
      serie: "F001",
      operation_type: "0101",
      issue_date: "2026-09-17",
      currency: "PEN",
      totals_mode: "auto",
      customer: {
        identity_type: "6",
        identity_number: "20123456789",
        name: "JWT Emit Co",
      },
      lines: [
        {
          id: 1,
          quantity: 1,
          unit_code: "NIU",
          description: "JWT smoke line",
          unit_value: 50,
          unit_price: 59,
          tax_affectation: "10",
          igv_percent: 18,
          tax_scheme_id: "1000",
        },
      ],
    };

    const created = await request(server)
      .post("/v1/invoices")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", `jwt-inv-${Date.now()}`)
      .send(invoiceBody)
      .expect(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.environment).toBeTruthy();
    expect(created.body.customer).toMatchObject({ name: "JWT Emit Co" });

    let status = created.body.status as string;
    for (
      let i = 0;
      i < 40 &&
      !["accepted", "accepted_with_observation", "rejected", "failed", "cancelled"].includes(
        status,
      );
      i++
    ) {
      await new Promise((r) => setTimeout(r, 250));
      const got = await request(server)
        .get(`/v1/documents/${created.body.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      status = got.body.status as string;
    }
    expect([
      "accepted",
      "accepted_with_observation",
      "queued",
      "sent",
      "ticket_pending",
    ]).toContain(status);
  });

  it("JWT owner can list GRE types and emit despatch advice (S11-GRE dual auth)", async () => {
    if (!companyId) {
      const list = await request(server)
        .get("/companies")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const first = (list.body as { id: string }[])[0];
      if (!first) throw new Error("no company");
      companyId = first.id;
    }

    await request(server)
      .put(`/companies/${companyId}/gre-credentials`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ client_id: "gre-jwt-client", client_secret: "gre-jwt-secret" })
      .expect(204);

    const seriesList = await request(server)
      .get(`/companies/${companyId}/series`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const series = seriesList.body as { serie: string; documentType: string }[];
    if (!series.some((s) => s.serie === "T001" && s.documentType === "09")) {
      await request(server)
        .post(`/companies/${companyId}/series`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ document_type: "09", serie: "T001", next_number: 1 })
        .expect(201);
    }

    const listed = await request(server)
      .get("/v1/documents")
      .query({ company_id: companyId, document_type: "09,31", limit: 10 })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
    for (const item of listed.body.items as { document_type: string }[]) {
      expect(["09", "31"]).toContain(item.document_type);
    }

    const created = await request(server)
      .post("/v1/despatch-advices")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", `jwt-gre-${Date.now()}`)
      .send({
        company_id: companyId,
        document_type: "09",
        serie: "T001",
        issue_date: "2026-09-17",
        delivery_customer: {
          identity_type: "6",
          identity_number: "20123456789",
          name: "JWT GRE Co",
        },
        shipment: {
          transfer_reason_code: "01",
          transport_mode_code: "01",
          gross_weight: 5,
          gross_weight_unit: "KGM",
          start_date: "2026-09-17",
          carrier: {
            identity_type: "6",
            identity_number: "20600000000",
            name: "TRANSPORTE JWT",
          },
          origin: { ubigeo: "150101", address: "Origen JWT" },
          destination: { ubigeo: "150122", address: "Destino JWT" },
        },
        lines: [
          {
            id: 1,
            quantity: 1,
            unit_code: "NIU",
            description: "JWT GRE line",
          },
        ],
      })
      .expect(201);
    expect(created.body.document_type).toBe("09");
    expect(created.body.id).toBeTruthy();
  });

  it("writes audit event on API key create and lists via GET audit-events", async () => {
    const created = await request(server)
      .post("/organizations/me/api-keys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `audit-key-${Date.now()}`,
        scopes: ["documents:read"],
      })
      .expect(201);

    expect(created.body.id).toBeTruthy();

    const audit = await request(server)
      .get("/organizations/me/audit-events")
      .query({ action: "api_key.created", limit: 20 })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(audit.body.items)).toBe(true);
    const hit = (audit.body.items as Array<Record<string, unknown>>).find(
      (e) => e.resource_id === created.body.id,
    );
    expect(hit).toBeTruthy();
    expect(hit?.action).toBe("api_key.created");
    expect(hit?.data).toMatchObject({
      name: created.body.name,
      key_prefix: created.body.keyPrefix,
    });
    expect((hit?.data as { secret?: string }).secret).toBe("[REDACTED]");
  });
});
