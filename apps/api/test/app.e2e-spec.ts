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
    process.env["RATE_LIMIT_LOGIN_RPM"] = "5000";
    process.env["RATE_LIMIT_SIGNUP_RPM"] = "5000";
    process.env["RATE_LIMIT_FORGOT_RPM"] = "5000";
    process.env["CREDENTIALS_MASTER_KEY"] =
      process.env["CREDENTIALS_MASTER_KEY"] ??
      Buffer.alloc(32, 7).toString("base64");
    process.env["SUNAT_BILL_MODE"] = "fake";
    process.env["SUNAT_GRE_MODE"] = "fake";
    process.env["PDF_RI_MODE"] = "fake";
    process.env["SUNAT_VALIDEZ_MODE"] = "fake";
    process.env["WEBHOOK_ALLOW_LOCALHOST"] = "1";
    process.env["EMAIL_DRIVER"] = "log";

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
        email: "cliente@factosysperu.com",
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

  it("S14-PLAN: public catalog, platform CRUD/retire, assign + audit, org 403", async () => {
    const catalog = await request(server).get("/saas/plans").expect(200);
    const codes = (catalog.body.items as Array<{ code: string }>).map(
      (p) => p.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining(["starter"]),
    );
    const starter = (
      catalog.body.items as Array<{ id: string; code: string; active: boolean }>
    ).find((p) => p.code === "starter");
    expect(starter?.active).toBe(true);

    await request(server)
      .post("/saas/plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "org-forbidden",
        name: "X",
        price_monthly_cents: 100,
        price_display: "S/ 1",
        currency: "PEN",
        max_companies: 1,
        max_users: 1,
        max_documents_per_month: 10,
        max_api_keys: 1,
      })
      .expect(403);

    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const unique = `e2e-${Date.now()}`;
    const created = await request(server)
      .post("/saas/plans")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        code: unique,
        name: "E2E Plan",
        description: "temp",
        price_monthly_cents: 9900,
        price_display: "S/ 99",
        currency: "PEN",
        max_companies: 2,
        max_users: 4,
        max_documents_per_month: 200,
        max_api_keys: 2,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      code: unique,
      active: true,
      max_companies: 2,
      price_display: "S/ 99",
    });

    const patched = await request(server)
      .patch(`/saas/plans/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ name: "E2E Plan Patched", max_users: 8 })
      .expect(200);
    expect(patched.body.name).toBe("E2E Plan Patched");
    expect(patched.body.max_users).toBe(8);

    const retired = await request(server)
      .delete(`/saas/plans/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(retired.body.active).toBe(false);

    await request(server)
      .get(`/saas/plans/${created.body.id as string}`)
      .expect(404);

    const orgId = JSON.parse(
      Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8"),
    ).org as string;

    await request(server)
      .post("/saas/org-plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ organization_id: orgId, plan_id: starter!.id })
      .expect(403);

    const assigned = await request(server)
      .post("/saas/org-plans")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        organization_id: orgId,
        plan_id: starter!.id,
        status: "active",
      })
      .expect(201);
    expect(assigned.body).toMatchObject({
      organization_id: orgId,
      plan_id: starter!.id,
      plan_code: "starter",
      status: "active",
    });

    const listed = await request(server)
      .get("/saas/org-plans")
      .query({ organization_id: orgId })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(
      (listed.body.items as Array<{ id: string }>).some(
        (r) => r.id === assigned.body.id,
      ),
    ).toBe(true);

    const eventKey = `plan.assigned:${assigned.body.id as string}`;
    let notifOk = false;
    for (let i = 0; i < 40; i++) {
      const notifs = await request(server)
        .get("/saas/notifications")
        .query({ event_key: eventKey })
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      if ((notifs.body.items as unknown[]).length > 0) {
        notifOk = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(notifOk).toBe(true);

    const audit = await request(server)
      .get("/organizations/me/audit-events")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const hit = (audit.body.items as Array<Record<string, unknown>>).find(
      (e) => e.resource_id === assigned.body.id && e.action === "plan.assigned",
    );
    expect(hit).toBeTruthy();
  }, 30_000);

  it("public signup: POST /saas/public/signup-requests → 201", async () => {
    const ruc = String(20000000000 + (Date.now() % 1000000000)).padStart(
      11,
      "2",
    );
    const res = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "E2E Landing SAC",
        ruc,
        contact_name: "Ana Demo",
        contact_email: `signup-e2e-${Date.now()}@example.com`,
        plan_code: "starter",
        notes: "Desde e2e",
        accept_privacy: true,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      company_name: "E2E Landing SAC",
      ruc,
      contact_name: "Ana Demo",
      status: "received",
    });
    expect(res.body.id).toBeTruthy();
    expect(res.body.created_at).toBeTruthy();

    await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "X",
        ruc: "20123456789",
        contact_name: "X",
        contact_email: "bad@example.com",
        accept_privacy: false,
      })
      .expect(400);
  });

  it(
    "signup notifications: acuse+received deliveries; event_key idempotent",
    async () => {
      await request(server)
        .get("/saas/notifications")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);

      const platformLogin = await request(server)
        .post("/auth/login")
        .send({
          email: "platform@factosysperu.com",
          password: "PlatformAdmin!2026",
          organization_slug: "factosys-platform",
        })
        .expect(200);
      const platformToken = platformLogin.body.access_token as string;

      const ruc = String(20000000000 + (Date.now() % 1000000000)).padStart(
        11,
        "2",
      );
      const created = await request(server)
        .post("/saas/public/signup-requests")
        .send({
          company_name: "E2E Notif SAC",
          ruc,
          contact_name: "Notif Demo",
          contact_email: `signup-notif-${Date.now()}@example.com`,
          accept_privacy: true,
        })
        .expect(201);

      const signupId = created.body.id as string;
      const acuseKey = `signup:${signupId}:acuse`;
      const receivedKey = `signup:${signupId}:received`;

      const waitDelivery = async (eventKey: string) => {
        for (let i = 0; i < 40; i++) {
          const listed = await request(server)
            .get("/saas/notifications")
            .query({ event_key: eventKey })
            .set("Authorization", `Bearer ${platformToken}`)
            .expect(200);
          const item = (
            listed.body.items as Array<Record<string, unknown>>
          )[0];
          if (item?.status === "success") {
            return item;
          }
          if (item?.status === "failed") {
            throw new Error(
              `delivery ${eventKey} failed: ${String(item.last_error)}`,
            );
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`delivery ${eventKey} did not reach success`);
      };

      const acuse = await waitDelivery(acuseKey);
      expect(acuse.template_code).toBe("signup.acuse");
      const received = await waitDelivery(receivedKey);
      expect(received.template_code).toBe("signup.received");

      const listedAgain = await request(server)
        .get("/saas/notifications")
        .query({ event_key: acuseKey })
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      expect(listedAgain.body.items).toHaveLength(1);
    },
    15_000,
  );

  it("signup requests platform: org JWT → 403; list/detail/patch", async () => {
    await request(server)
      .get("/saas/signup-requests")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const ruc = String(20000000000 + (Date.now() % 1000000000)).padStart(
      11,
      "2",
    );
    const email = `signup-plat-${Date.now()}@example.com`;
    const created = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "E2E Platform SAC",
        ruc,
        contact_name: "Ops Demo",
        contact_email: email,
        plan_code: "starter",
        accept_privacy: true,
      })
      .expect(201);

    const listed = await request(server)
      .get("/saas/signup-requests")
      .query({ status: "received", q: "E2E Platform" })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);

    expect(Array.isArray(listed.body.items)).toBe(true);
    expect(listed.body).toHaveProperty("next_cursor");
    const hit = (
      listed.body.items as Array<Record<string, unknown>>
    ).find((d) => d.id === created.body.id);
    expect(hit).toBeTruthy();
    expect(hit?.status).toBe("received");

    const detail = await request(server)
      .get(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      id: created.body.id,
      company_name: "E2E Platform SAC",
      status: "received",
    });

    const patched = await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "under_review" })
      .expect(200);
    expect(patched.body.status).toBe("under_review");

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "received" })
      .expect(409);

    const approved = await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "approved" })
      .expect(200);
    expect(approved.body.status).toBe("approved");
    expect(approved.body.organization_id).toBeTruthy();

    const { DB } = await import("../src/infrastructure/persistence/db.tokens");
    const {
      organizations,
      orgPlans,
      users,
      notificationDeliveries,
    } = await import("@factosys/db");
    const { and, eq } = await import("drizzle-orm");
    const db = app.get(DB);

    const orgId = approved.body.organization_id as string;
    const orgRows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    expect(orgRows[0]?.status).toBe("active");
    expect(orgRows[0]?.name).toBe("E2E Platform SAC");

    const ownerRows = await db
      .select()
      .from(users)
      .where(
        and(eq(users.organizationId, orgId), eq(users.email, email)),
      )
      .limit(1);
    expect(ownerRows[0]?.status).toBe("disabled");

    const planRows = await db
      .select()
      .from(orgPlans)
      .where(
        and(eq(orgPlans.organizationId, orgId), eq(orgPlans.status, "active")),
      )
      .limit(1);
    expect(planRows[0]).toBeTruthy();

    const waitDelivery = async (eventKey: string) => {
      for (let i = 0; i < 40; i++) {
        const listed = await request(server)
          .get("/saas/notifications")
          .query({ event_key: eventKey })
          .set("Authorization", `Bearer ${platformToken}`)
          .expect(200);
        const item = (
          listed.body.items as Array<Record<string, unknown>>
        )[0];
        if (item?.status === "success") return item;
        if (item?.status === "failed") {
          throw new Error(
            `delivery ${eventKey} failed: ${String(item.last_error)}`,
          );
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`delivery ${eventKey} did not reach success`);
    };

    const signupId = created.body.id as string;
    await waitDelivery(`signup:${signupId}:approved`);

    let inviteToken: string | undefined;
    for (let i = 0; i < 40; i++) {
      const inviteRows = await db
        .select()
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.templateCode, "invite.owner"),
            eq(notificationDeliveries.toEmail, email),
          ),
        )
        .limit(1);
      const row = inviteRows[0];
      if (row?.status === "success") {
        inviteToken = (row.payload as { invite_token?: string } | null)
          ?.invite_token;
        break;
      }
      if (row?.status === "failed") {
        throw new Error(`invite.owner failed: ${String(row.lastError)}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(inviteToken).toBeTruthy();

    const password = "OwnerInvite!2026";
    await request(server)
      .post("/auth/accept-invite")
      .send({ token: inviteToken, password })
      .expect(200);

    const loginOwner = await request(server)
      .post("/auth/login")
      .send({
        email,
        password,
        organization_id: orgId,
      })
      .expect(200);
    expect(loginOwner.body.access_token).toBeTruthy();

    const invitePayload = inviteToken
      ? (
          await db
            .select()
            .from(notificationDeliveries)
            .where(
              and(
                eq(notificationDeliveries.templateCode, "invite.owner"),
                eq(notificationDeliveries.toEmail, email),
              ),
            )
            .limit(1)
        )[0]?.payload
      : null;
    expect(
      String(
        (invitePayload as { invite_url?: string } | null)?.invite_url ?? "",
      ),
    ).toContain("/auth/accept-invite?token=");

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "rejected" })
      .expect(409);
  }, 30_000);

  it("onboarding: status incomplete → company + legal → complete", async () => {
    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const ruc = makeValidUniqueRuc(Date.now());
    const email = `onb-e2e-${Date.now()}@example.com`;
    const created = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "E2E Onboarding SAC",
        ruc,
        contact_name: "Onb Owner",
        contact_email: email,
        plan_code: "starter",
        accept_privacy: true,
      })
      .expect(201);

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "under_review" })
      .expect(200);

    const approved = await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "approved" })
      .expect(200);
    const orgId = approved.body.organization_id as string;

    const { DB } = await import("../src/infrastructure/persistence/db.tokens");
    const { notificationDeliveries } = await import("@factosys/db");
    const { and, eq } = await import("drizzle-orm");
    const db = app.get(DB);

    let inviteToken: string | undefined;
    for (let i = 0; i < 40; i++) {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.templateCode, "invite.owner"),
            eq(notificationDeliveries.toEmail, email),
          ),
        )
        .limit(1);
      if (rows[0]?.status === "success") {
        inviteToken = (rows[0].payload as { invite_token?: string })
          ?.invite_token;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(inviteToken).toBeTruthy();

    const password = "OnboardOwner!2026";
    await request(server)
      .post("/auth/accept-invite")
      .send({ token: inviteToken, password })
      .expect(200);

    const loginOwner = await request(server)
      .post("/auth/login")
      .send({ email, password, organization_id: orgId })
      .expect(200);
    const ownerToken = loginOwner.body.access_token as string;

    await request(server)
      .get("/saas/onboarding/status")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(403);

    const status0 = await request(server)
      .get("/saas/onboarding/status")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(status0.body.complete).toBe(false);
    expect(status0.body.has_company).toBe(false);
    expect(status0.body.requires_reaccept).toBe(false);
    expect(status0.body.hints?.ruc).toBe(ruc);

    const legal = await request(server)
      .get("/saas/onboarding/legal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    const docs = legal.body.items as Array<{ id: string; code: string }>;
    expect(docs).toHaveLength(2);

    await request(server)
      .post("/companies")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ruc,
        legal_name: "E2E Onboarding SAC",
        environment: "sandbox",
        seed_default_series: true,
      })
      .expect(201);

    const accepted = await request(server)
      .post("/saas/onboarding/accept-legal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ document_ids: docs.map((d) => d.id) })
      .expect(200);
    expect(accepted.body.complete).toBe(true);
    expect(accepted.body.has_company).toBe(true);
    expect(accepted.body.requires_reaccept).toBe(false);
    expect(accepted.body.legal.privacy).toBe(true);
    expect(accepted.body.legal.terms).toBe(true);

    const { legalAcceptances } = await import("@factosys/db");
    const { eq: eqCol } = await import("drizzle-orm");
    const acceptanceRows = await db
      .select()
      .from(legalAcceptances)
      .where(eqCol(legalAcceptances.organizationId, orgId));
    expect(acceptanceRows.length).toBeGreaterThanOrEqual(2);
    for (const row of acceptanceRows) {
      expect(row.bodyHash).toMatch(/^[a-f0-9]{64}$/);
    }
  }, 30_000);

  it("S16-LEG: publish draft → immutable; re-accept + body_hash; org JWT denied", async () => {
    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    await request(server)
      .post(`/saas/legal/documents/00000000-0000-4000-8000-000000000001/publish`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    const stamp = Date.now();
    const privacyBody = `# Privacy v2\n\nE2E privacy body ${stamp}`;
    const termsBody = `# Terms v2\n\nE2E terms body ${stamp}`;

    const privacyDraft = await request(server)
      .post("/saas/legal/documents")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        code: "privacy.es-PE",
        version: 1000 + (stamp % 100000),
        title: "Privacidad E2E v2",
        body_md: privacyBody,
      })
      .expect(201);

    const termsDraft = await request(server)
      .post("/saas/legal/documents")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        code: "terms.es-PE",
        version: 1000 + (stamp % 100000),
        title: "Términos E2E v2",
        body_md: termsBody,
      })
      .expect(201);

    const publishedPrivacy = await request(server)
      .post(`/saas/legal/documents/${privacyDraft.body.id as string}/publish`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(publishedPrivacy.body.status).toBe("published");
    expect(publishedPrivacy.body.published_at).toBeTruthy();
    expect(publishedPrivacy.body.hash).toMatch(/^[a-f0-9]{64}$/);

    const publishedTerms = await request(server)
      .post(`/saas/legal/documents/${termsDraft.body.id as string}/publish`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(publishedTerms.body.status).toBe("published");

    await request(server)
      .patch(`/saas/legal/documents/${publishedPrivacy.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ body_md: "tamper" })
      .expect(409);

    const ruc = makeValidUniqueRuc(Date.now() + 7);
    const email = `leg-reaccept-${Date.now()}@example.com`;
    const created = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "E2E Legal Reaccept SAC",
        ruc,
        contact_name: "Legal Owner",
        contact_email: email,
        plan_code: "starter",
        accept_privacy: true,
      })
      .expect(201);

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "under_review" })
      .expect(200);

    const approved = await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "approved" })
      .expect(200);
    const orgId = approved.body.organization_id as string;

    const { DB } = await import("../src/infrastructure/persistence/db.tokens");
    const { notificationDeliveries, legalAcceptances } = await import(
      "@factosys/db"
    );
    const { and, eq } = await import("drizzle-orm");
    const db = app.get(DB);

    let inviteToken: string | undefined;
    for (let i = 0; i < 40; i++) {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.templateCode, "invite.owner"),
            eq(notificationDeliveries.toEmail, email),
          ),
        )
        .limit(1);
      if (rows[0]?.status === "success") {
        inviteToken = (rows[0].payload as { invite_token?: string })
          ?.invite_token;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(inviteToken).toBeTruthy();

    const password = "LegalReaccept!2026";
    await request(server)
      .post("/auth/accept-invite")
      .send({ token: inviteToken, password })
      .expect(200);

    const loginOwner = await request(server)
      .post("/auth/login")
      .send({ email, password, organization_id: orgId })
      .expect(200);
    const ownerToken = loginOwner.body.access_token as string;

    await request(server)
      .post("/companies")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ruc,
        legal_name: "E2E Legal Reaccept SAC",
        environment: "sandbox",
        seed_default_series: true,
      })
      .expect(201);

    const statusBefore = await request(server)
      .get("/saas/onboarding/status")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(statusBefore.body.has_company).toBe(true);
    expect(statusBefore.body.requires_reaccept).toBe(true);
    expect(statusBefore.body.complete).toBe(false);

    const legal = await request(server)
      .get("/saas/onboarding/legal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    const docs = legal.body.items as Array<{
      id: string;
      code: string;
      hash: string;
    }>;
    expect(docs).toHaveLength(2);
    expect(docs.find((d) => d.code === "privacy.es-PE")?.id).toBe(
      publishedPrivacy.body.id,
    );
    expect(docs.find((d) => d.code === "terms.es-PE")?.id).toBe(
      publishedTerms.body.id,
    );

    const accepted = await request(server)
      .post("/saas/onboarding/accept-legal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ document_ids: docs.map((d) => d.id) })
      .expect(200);
    expect(accepted.body.requires_reaccept).toBe(false);
    expect(accepted.body.complete).toBe(true);

    const acceptanceRows = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.organizationId, orgId));
    const byDoc = new Map(
      acceptanceRows.map((r) => [r.legalDocumentId, r] as const),
    );
    for (const doc of docs) {
      const row = byDoc.get(doc.id);
      expect(row?.bodyHash).toBe(doc.hash);
      expect(row?.ip != null || row?.userAgent != null).toBe(true);
    }
  }, 45_000);

  it("signup reject: notes required; rejected + signup.rejected delivery", async () => {
    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const ruc = String(20000000000 + (Date.now() % 1000000000)).padStart(
      11,
      "2",
    );
    const created = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "E2E Reject SAC",
        ruc,
        contact_name: "Reject Demo",
        contact_email: `signup-reject-${Date.now()}@example.com`,
        plan_code: "starter",
        accept_privacy: true,
      })
      .expect(201);

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "under_review" })
      .expect(200);

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "rejected" })
      .expect(400);

    const rejected = await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "rejected", notes: "RUC no válido para onboarding" })
      .expect(200);
    expect(rejected.body.status).toBe("rejected");
    expect(rejected.body.notes).toContain("RUC");

    const signupId = created.body.id as string;
    for (let i = 0; i < 40; i++) {
      const listed = await request(server)
        .get("/saas/notifications")
        .query({ event_key: `signup:${signupId}:rejected` })
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      const item = (listed.body.items as Array<Record<string, unknown>>)[0];
      if (item?.status === "success") {
        expect(item.template_code).toBe("signup.rejected");
        return;
      }
      if (item?.status === "failed") {
        throw new Error(`rejected delivery failed: ${String(item.last_error)}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("signup.rejected delivery did not reach success");
  }, 15_000);

  it("platform health: org JWT → 403; platform JWT → 200", async () => {
    const orgDenied = await request(server)
      .get("/saas/platform/health")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(orgDenied.body).toMatchObject({
      code: "FACTOSYS_FORBIDDEN",
    });

    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);

    const platformToken = platformLogin.body.access_token as string;
    const ok = await request(server)
      .get("/saas/platform/health")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(ok.body).toEqual({ status: "ok" });
  });

  it("legal drafts: org JWT → 403; platform create + list", async () => {
    await request(server)
      .get("/saas/legal/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const code = `e2e-legal-${Date.now()}`;
    const bodyMd = "# Draft\n\nE2E legal document body.";
    const created = await request(server)
      .post("/saas/legal/documents")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        code,
        title: "E2E Legal Draft",
        body_md: bodyMd,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      code,
      version: 1,
      title: "E2E Legal Draft",
      body_md: bodyMd,
      status: "draft",
    });
    expect(created.body.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.body.id).toBeTruthy();

    const listed = await request(server)
      .get("/saas/legal/documents")
      .query({ status: "draft" })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);

    expect(Array.isArray(listed.body.items)).toBe(true);
    const hit = (
      listed.body.items as Array<Record<string, unknown>>
    ).find((d) => d.id === created.body.id);
    expect(hit).toBeTruthy();
    expect(hit?.hash).toBe(created.body.hash);

    const patched = await request(server)
      .patch(`/saas/legal/documents/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ body_md: "# Draft\n\nUpdated body." })
      .expect(200);
    expect(patched.body.hash).not.toBe(created.body.hash);
    expect(patched.body.body_md).toContain("Updated body");
  });

  it("S14-PLAT API: stats, orgs suspend, platform plans; org JWT 403", async () => {
    await request(server).get("/saas/platform/stats").expect(401);
    await request(server)
      .get("/saas/platform/stats")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    await request(server)
      .get("/saas/organizations")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const stats = await request(server)
      .get("/saas/platform/stats")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(stats.body).toMatchObject({
      signup_requests: expect.objectContaining({ total: expect.any(Number) }),
      organizations: expect.objectContaining({ total: expect.any(Number) }),
      plans: expect.objectContaining({
        active: expect.any(Number),
        retired: expect.any(Number),
      }),
    });

    const adminPlans = await request(server)
      .get("/saas/platform/plans")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(
      (adminPlans.body.items as Array<{ code: string }>).some(
        (p) => p.code === "starter",
      ),
    ).toBe(true);

    const orgs = await request(server)
      .get("/saas/organizations")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const demo = (
      orgs.body.items as Array<{ id: string; slug: string | null }>
    ).find((o) => o.slug === "demo");
    expect(demo).toBeTruthy();

    const suspended = await request(server)
      .patch(`/saas/organizations/${demo!.id}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "suspended" })
      .expect(200);
    expect(suspended.body.status).toBe("suspended");

    const suspendAudit = await request(server)
      .get("/saas/platform/audit-events")
      .query({ action: "organization.suspended", limit: 20 })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const suspendHit = (
      suspendAudit.body.items as Array<Record<string, unknown>>
    ).find(
      (e) =>
        e.action === "organization.suspended" &&
        e.resource_id === demo!.id,
    );
    expect(suspendHit).toBeTruthy();
    expect(suspendHit?.organization_id).toBe(demo!.id);

    const reactivated = await request(server)
      .patch(`/saas/organizations/${demo!.id}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "active" })
      .expect(200);
    expect(reactivated.body.status).toBe("active");

    const reactivateAudit = await request(server)
      .get("/saas/platform/audit-events")
      .query({ action: "organization.reactivated", limit: 20 })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(
      (
        reactivateAudit.body.items as Array<Record<string, unknown>>
      ).some(
        (e) =>
          e.action === "organization.reactivated" &&
          e.resource_id === demo!.id,
      ),
    ).toBe(true);
  });

  it("S16-AUD: platform audit list; org 403; approve action; legal publish visible", async () => {
    await request(server)
      .get("/saas/platform/audit-events")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const ruc = makeValidUniqueRuc(Date.now() + 91);
    const email = `aud-approve-${Date.now()}@example.com`;
    const created = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "E2E Audit Approve SAC",
        ruc,
        contact_name: "Audit Demo",
        contact_email: email,
        plan_code: "starter",
        accept_privacy: true,
      })
      .expect(201);

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "under_review" })
      .expect(200);

    await request(server)
      .patch(`/saas/signup-requests/${created.body.id as string}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ status: "approved" })
      .expect(200);

    const approveAudit = await request(server)
      .get("/saas/platform/audit-events")
      .query({ action: "signup_request.approved", limit: 50 })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const approveHit = (
      approveAudit.body.items as Array<Record<string, unknown>>
    ).find((e) => e.resource_id === created.body.id);
    expect(approveHit).toBeTruthy();
    expect(approveHit?.action).toBe("signup_request.approved");
    expect(
      JSON.stringify(approveHit?.data ?? {}).toLowerCase(),
    ).not.toMatch(/password|secret|token(?!_)/);

    const stamp = Date.now();
    const draft = await request(server)
      .post("/saas/legal/documents")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        code: `e2e-aud-legal-${stamp}`,
        title: "Audit legal draft",
        body_md: `# Audit\n\nbody ${stamp}`,
      })
      .expect(201);

    const published = await request(server)
      .post(`/saas/legal/documents/${draft.body.id as string}/publish`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(published.body.status).toBe("published");

    const legalAudit = await request(server)
      .get("/saas/platform/audit-events")
      .query({ action: "legal.document.published", limit: 50 })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const legalHit = (
      legalAudit.body.items as Array<Record<string, unknown>>
    ).find((e) => e.resource_id === published.body.id);
    expect(legalHit).toBeTruthy();
    expect(legalHit?.organization_id).toBeNull();

    const planAudit = await request(server)
      .get("/saas/platform/audit-events")
      .query({ action: "plan.assigned", limit: 20 })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    expect(Array.isArray(planAudit.body.items)).toBe(true);
  }, 30_000);

  it("refresh rotation: new token works; reused old refresh → 401", async () => {
    const login = await request(server)
      .post("/auth/login")
      .send({
        email: "cliente@factosysperu.com",
        password: "DemoOwner!2026",
        organization_slug: "demo",
      })
      .expect(200);

    const oldRefresh = login.body.refresh_token as string;
    const rotated = await request(server)
      .post("/auth/refresh")
      .send({ refresh_token: oldRefresh })
      .expect(200);

    expect(rotated.body.refresh_token).toBeTruthy();
    expect(rotated.body.refresh_token).not.toBe(oldRefresh);
    expect(rotated.body.access_token).toBeTruthy();

    await request(server)
      .post("/auth/refresh")
      .send({ refresh_token: oldRefresh })
      .expect(401);

    await request(server)
      .post("/auth/refresh")
      .send({ refresh_token: rotated.body.refresh_token })
      .expect(200);
  });

  it("S15-APP: plan usage, invite member, plan change, inbox prefs", async () => {
    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    // Extra catalog entries belong to this scenario, not the minimal development seed.
    const catalog = await request(server)
      .get("/saas/platform/plans")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    if (!(catalog.body.items as Array<{ code: string }>).some((plan) => plan.code === "growth")) {
      await request(server)
        .post("/saas/plans")
        .set("Authorization", `Bearer ${platformToken}`)
        .send({
          code: "growth",
          name: "Growth",
          price_monthly_cents: 14900,
          price_display: "S/ 149",
          currency: "PEN",
          max_companies: 3,
          max_users: 10,
          max_documents_per_month: 1000,
          max_api_keys: 5,
        })
        .expect(201);
    }

    const orgs = await request(server)
      .get("/saas/organizations")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const demoOrg = (
      orgs.body.items as Array<{ id: string; slug: string }>
    ).find((o) => o.slug === "demo");
    expect(demoOrg).toBeTruthy();

    const plans = await request(server)
      .get("/saas/platform/plans")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const starter = (
      plans.body.items as Array<{ id: string; code: string }>
    ).find((p) => p.code === "starter");
    const growth = (
      plans.body.items as Array<{ id: string; code: string }>
    ).find((p) => p.code === "growth");
    expect(starter).toBeTruthy();
    expect(growth).toBeTruthy();

    await request(server)
      .post("/saas/org-plans")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        organization_id: demoOrg!.id,
        plan_id: starter!.id,
        status: "active",
      })
      .expect(201);

    const planMe = await request(server)
      .get("/organizations/me/plan")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(planMe.body.plan?.code).toBe("starter");
    expect(planMe.body.limits?.max_companies).toBeGreaterThanOrEqual(1);
    expect(planMe.body.usage).toMatchObject({
      companies: expect.any(Number),
      users: expect.any(Number),
      api_keys: expect.any(Number),
      documents_this_month: expect.any(Number),
    });

    const inviteEmail = `member-e2e-${Date.now()}@example.com`;
    const invited = await request(server)
      .post("/organizations/me/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: inviteEmail,
        name: "Member E2E",
        invite: true,
        roles: ["viewer"],
      })
      .expect(201);
    expect(invited.body.status).toBe("disabled");
    expect(invited.body.invited).toBe(true);

    const { DB } = await import("../src/infrastructure/persistence/db.tokens");
    const { notificationDeliveries } = await import("@factosys/db");
    const { and, eq } = await import("drizzle-orm");
    const db = app.get(DB);

    let inviteToken: string | undefined;
    let lastInviteRows: Array<{
      status: string;
      toEmail: string;
      payload: Record<string, unknown>;
    }> = [];
    for (let i = 0; i < 40; i++) {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.templateCode, "invite.member"))
        .limit(10);
      lastInviteRows = rows.map((r) => ({
        status: r.status,
        toEmail: r.toEmail,
        payload: (r.payload ?? {}) as Record<string, unknown>,
      }));
      const match = rows.find((r) => r.toEmail === inviteEmail);
      if (match) {
        inviteToken = (match.payload as { invite_token?: string })?.invite_token;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(
      inviteToken,
      `invite.member missing for ${inviteEmail}; rows=${JSON.stringify(lastInviteRows)}`,
    ).toBeTruthy();

    await request(server)
      .post("/auth/accept-invite")
      .send({ token: inviteToken, password: "MemberPass!2026" })
      .expect(200);

    const existingPending = await request(server)
      .get("/organizations/me/plan/change-requests")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    let changeBody = (
      existingPending.body.items as Array<{
        id: string;
        status: string;
        requested_plan_code: string;
      }>
    ).find((i) => i.status === "pending");

    if (!changeBody) {
      const change = await request(server)
        .post("/organizations/me/plan/change-requests")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          requested_plan_code: "growth",
          message: "Necesitamos más documentos",
        })
        .expect(201);
      changeBody = change.body;
    }
    expect(changeBody!.requested_plan_code).toBe("growth");
    expect(changeBody!.status).toBe("pending");

    let opsDeliveryOk = false;
    for (let i = 0; i < 40; i++) {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(
          eq(
            notificationDeliveries.templateCode,
            "plan.change_requested",
          ),
        )
        .limit(10);
      if (
        rows.some(
          (r) =>
            (r.payload as { request_id?: string })?.request_id ===
            changeBody!.id,
        )
      ) {
        opsDeliveryOk = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(opsDeliveryOk).toBe(true);

    const inbox = await request(server)
      .get("/organizations/me/notifications")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(inbox.body.unread_count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(inbox.body.items)).toBe(true);
    const first = inbox.body.items[0] as { id: string };
    await request(server)
      .post(`/organizations/me/notifications/${first.id}/read`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const prefs = await request(server)
      .get("/organizations/me/notification-preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(prefs.body.items.length).toBeGreaterThanOrEqual(4);

    await request(server)
      .patch("/organizations/me/notification-preferences")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [
          {
            event_code: "system",
            email_enabled: false,
            in_app_enabled: true,
          },
        ],
      })
      .expect(200);

    await request(server)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        current_password: "DemoOwner!2026",
        new_password: "DemoOwner!2026x",
      })
      .expect(204);

    await request(server)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        current_password: "DemoOwner!2026x",
        new_password: "DemoOwner!2026",
      })
      .expect(204);
  }, 45_000);

  it("S17-SEC: forgot-password always 200 (no leak)", async () => {
    const ok = await request(server)
      .post("/auth/forgot-password")
      .send({ email: "nobody-exists@example.com" })
      .expect(200);
    expect(ok.body).toMatchObject({ status: "ok" });
    expect(String(ok.body.message)).toMatch(/if an account exists/i);
  });

  it(
    "S17-SEC cross-tenant fail-closed: foreign resources 404; platform routes 403",
    async () => {
      const platformLogin = await request(server)
        .post("/auth/login")
        .send({
          email: "platform@factosysperu.com",
          password: "PlatformAdmin!2026",
          organization_slug: "factosys-platform",
        })
        .expect(200);
      const platformToken = platformLogin.body.access_token as string;

      const ruc = makeValidUniqueRuc(Date.now() + 17);
      const email = `sec-xt-${Date.now()}@example.com`;
      const created = await request(server)
        .post("/saas/public/signup-requests")
        .send({
          company_name: "E2E Sec Cross Tenant SAC",
          ruc,
          contact_name: "Sec XT",
          contact_email: email,
          plan_code: "starter",
          accept_privacy: true,
        })
        .expect(201);

      await request(server)
        .patch(`/saas/signup-requests/${created.body.id as string}`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ status: "under_review" })
        .expect(200);

      const approved = await request(server)
        .patch(`/saas/signup-requests/${created.body.id as string}`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ status: "approved" })
        .expect(200);
      const orgBId = approved.body.organization_id as string;

      const { DB } = await import("../src/infrastructure/persistence/db.tokens");
      const { notificationDeliveries } = await import("@factosys/db");
      const { and, eq } = await import("drizzle-orm");
      const db = app.get(DB);

      let inviteToken: string | undefined;
      for (let i = 0; i < 40; i++) {
        const inviteRows = await db
          .select()
          .from(notificationDeliveries)
          .where(
            and(
              eq(notificationDeliveries.templateCode, "invite.owner"),
              eq(notificationDeliveries.toEmail, email),
            ),
          )
          .limit(1);
        const row = inviteRows[0];
        if (row?.status === "success") {
          inviteToken = (row.payload as { invite_token?: string } | null)
            ?.invite_token;
          break;
        }
        if (row?.status === "failed") {
          throw new Error(`invite.owner failed: ${String(row.lastError)}`);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(inviteToken).toBeTruthy();

      const password = "SecCrossTenant!2026";
      await request(server)
        .post("/auth/accept-invite")
        .send({ token: inviteToken, password })
        .expect(200);

      const loginB = await request(server)
        .post("/auth/login")
        .send({ email, password, organization_id: orgBId })
        .expect(200);
      const tokenB = loginB.body.access_token as string;

      const companyB = await request(server)
        .post("/companies")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          ruc,
          legal_name: "E2E Sec Cross Tenant SAC",
          environment: "sandbox",
        })
        .expect(201);
      const companyBId = companyB.body.id as string;

      const userB = await request(server)
        .post("/organizations/me/users")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          email: `viewer-b-${Date.now()}@example.com`,
          name: "Viewer B",
          password: "ViewerBPass1!",
          roles: ["viewer"],
        })
        .expect(201);
      const userBId = userB.body.id as string;

      const keyB = await request(server)
        .post("/organizations/me/api-keys")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          name: "sec-xt-key",
          scopes: ["documents:read"],
        })
        .expect(201);
      const keyBId = keyB.body.id as string;

      // Org A (demo) must not see Org B resources (fail-closed 404).
      await request(server)
        .get(`/companies/${companyBId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      await request(server)
        .put(`/organizations/me/users/${userBId}/roles`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ roles: ["viewer"] })
        .expect(404);

      await request(server)
        .delete(`/organizations/me/api-keys/${keyBId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      // Document id from another tenant → 404 via Org A API key (create key here;
      // filtered e2e runs may skip the suite-level key bootstrap).
      const keyA = await request(server)
        .post("/organizations/me/api-keys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: `sec-xt-a-${Date.now()}`,
          scopes: ["documents:read"],
        })
        .expect(201);
      const foreignDocId = "00000000-0000-4000-8000-00000000d0c1";
      await request(server)
        .get(`/v1/documents/${foreignDocId}`)
        .set("Authorization", `Bearer ${keyA.body.secret}`)
        .expect(404);

      // Platform-only SaaS routes (FE-471/472/473).
      await request(server)
        .get("/saas/signup-requests")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);
      await request(server)
        .get("/saas/notifications")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);
      await request(server)
        .get("/saas/organizations")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);

      // Foreign in-app notification id → 404.
      await request(server)
        .post(
          `/organizations/me/notifications/00000000-0000-4000-8000-00000000f001/read`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    },
    60_000,
  );

  it("S17-SEC impersonate: platform:admin + audit; platform_ops 403", async () => {
    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const orgs = await request(server)
      .get("/saas/organizations")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const demo = (
      orgs.body.items as Array<{ id: string; slug: string | null }>
    ).find((o) => o.slug === "demo");
    expect(demo).toBeTruthy();

    await request(server)
      .post("/saas/platform/impersonate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        organization_id: demo!.id,
        reason: "should fail for org JWT",
      })
      .expect(403);

    const { DB } = await import("../src/infrastructure/persistence/db.tokens");
    const {
      users,
      userRoles,
      roles,
      organizations,
      newId,
    } = await import("@factosys/db");
    const { eq } = await import("drizzle-orm");
    const argon2 = await import("argon2");
    const db = app.get(DB);

    const platformOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, "factosys-platform"))
      .limit(1);
    const platformOrgId = platformOrg[0]!.id;

    const opsEmail = `platform-ops-${Date.now()}@factosys.local`;
    const opsPassword = "PlatformOps!2026";
    const opsId = newId();
    const passwordHash = await argon2.hash(opsPassword, {
      type: argon2.argon2id,
    });
    await db.insert(users).values({
      id: opsId,
      organizationId: platformOrgId,
      email: opsEmail,
      name: "Platform Ops E2E",
      passwordHash,
      status: "active",
    });
    const opsRole = await db
      .select()
      .from(roles)
      .where(eq(roles.code, "platform_ops"))
      .limit(1);
    await db.insert(userRoles).values({
      userId: opsId,
      roleId: opsRole[0]!.id,
    });

    const opsLogin = await request(server)
      .post("/auth/login")
      .send({
        email: opsEmail,
        password: opsPassword,
        organization_slug: "factosys-platform",
      })
      .expect(200);
    await request(server)
      .post("/saas/platform/impersonate")
      .set("Authorization", `Bearer ${opsLogin.body.access_token}`)
      .send({
        organization_id: demo!.id,
        reason: "ops should not impersonate",
        ttl_minutes: 10,
      })
      .expect(403);

    const reason = "Investigar incidencia de facturación e2e";
    const imp = await request(server)
      .post("/saas/platform/impersonate")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        organization_id: demo!.id,
        reason,
        ttl_minutes: 15,
      })
      .expect(200);

    expect(imp.body.access_token).toBeTruthy();
    expect(imp.body.expires_in).toBe(15 * 60);
    expect(imp.body.organization_id).toBe(demo!.id);
    expect(imp.body.reason).toBe(reason);
    expect(imp.body.refresh_token).toBeUndefined();

    const me = await request(server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${imp.body.access_token}`)
      .expect(200);
    expect(me.body.email).toBe("platform@factosysperu.com");

    const companies = await request(server)
      .get("/companies")
      .set("Authorization", `Bearer ${imp.body.access_token}`)
      .expect(200);
    expect(Array.isArray(companies.body)).toBe(true);

    const audit = await request(server)
      .get("/saas/platform/audit-events")
      .query({ action: "support.impersonation.started", limit: 20 })
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const hit = (
      audit.body.items as Array<Record<string, unknown>>
    ).find(
      (e) =>
        e.action === "support.impersonation.started" &&
        e.resource_id === demo!.id,
    );
    expect(hit).toBeTruthy();
    expect(hit?.actor_type).toBe("support");
    expect((hit?.data as { reason?: string } | undefined)?.reason).toBe(reason);
  }, 45_000);

  it("S17-SEC rate limit abuse: login/signup/forgot → 429 + Retry-After", async () => {
    const { REDIS } = await import("../src/infrastructure/redis/redis.tokens");
    const redis = app.get(REDIS) as {
      set: (k: string, v: string, ...args: unknown[]) => Promise<unknown>;
    };

    // Pre-fill fixed windows to the configured high RPM so N+1 yields 429
    // without lowering env limits for the rest of the suite (ConfigModule cache).
    const loginEmail = `abuse-login-${Date.now()}@example.com`;
    await redis.set(`rl:login:${loginEmail}`, "5000", "EX", 60);
    const loginDenied = await request(server)
      .post("/auth/login")
      .send({
        email: loginEmail,
        password: "WrongPass!999",
        organization_slug: "demo",
      });
    expect(loginDenied.status).toBe(429);
    expect(loginDenied.body.code).toBe("FACTOSYS_RATE_LIMITED");
    const loginRetry = Number(loginDenied.headers["retry-after"]);
    expect(Number.isFinite(loginRetry)).toBe(true);
    expect(loginRetry).toBeGreaterThan(0);
    expect(loginRetry).toBeLessThanOrEqual(60);

    const signupEmail = `abuse-signup-${Date.now()}@example.com`;
    // Signup key is email:ip — supertest typically sees ::ffff:127.0.0.1 or similar.
    const signupResProbe = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "Abuse Probe",
        ruc: makeValidUniqueRuc(Date.now() + 3),
        contact_name: "Abuse",
        contact_email: signupEmail,
        plan_code: "starter",
        accept_privacy: true,
      });
    // First request succeeds and creates rl:signup:* — discover key via redis keys.
    expect([201, 429]).toContain(signupResProbe.status);
    const keys: string[] = await (
      redis as { keys: (p: string) => Promise<string[]> }
    ).keys(`rl:signup:${signupEmail}:*`);
    expect(keys.length).toBeGreaterThan(0);
    await redis.set(keys[0]!, "5000", "EX", 60);
    const signupDenied = await request(server)
      .post("/saas/public/signup-requests")
      .send({
        company_name: "Abuse Signup Over",
        ruc: makeValidUniqueRuc(Date.now() + 99),
        contact_name: "Abuse",
        contact_email: signupEmail,
        plan_code: "starter",
        accept_privacy: true,
      });
    expect(signupDenied.status).toBe(429);
    expect(signupDenied.body.code).toBe("FACTOSYS_RATE_LIMITED");
    const signupRetry = Number(signupDenied.headers["retry-after"]);
    expect(Number.isFinite(signupRetry)).toBe(true);
    expect(signupRetry).toBeGreaterThan(0);

    const forgotEmail = `abuse-forgot-${Date.now()}@example.com`;
    const forgotProbe = await request(server)
      .post("/auth/forgot-password")
      .send({ email: forgotEmail });
    expect(forgotProbe.status).toBe(200);
    const forgotKeys: string[] = await (
      redis as { keys: (p: string) => Promise<string[]> }
    ).keys(`rl:forgot:${forgotEmail}:*`);
    expect(forgotKeys.length).toBeGreaterThan(0);
    await redis.set(forgotKeys[0]!, "5000", "EX", 60);
    const forgotDenied = await request(server)
      .post("/auth/forgot-password")
      .send({ email: forgotEmail });
    expect(forgotDenied.status).toBe(429);
    const forgotRetry = Number(forgotDenied.headers["retry-after"]);
    expect(Number.isFinite(forgotRetry)).toBe(true);
    expect(forgotRetry).toBeGreaterThan(0);
  });

  it("S17-QA org export: POST → ready → download JSON without secrets", async () => {
    const platformLogin = await request(server)
      .post("/auth/login")
      .send({
        email: "platform@factosysperu.com",
        password: "PlatformAdmin!2026",
        organization_slug: "factosys-platform",
      })
      .expect(200);
    const platformToken = platformLogin.body.access_token as string;

    const orgs = await request(server)
      .get("/saas/organizations")
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const demo = (
      orgs.body.items as Array<{ id: string; slug: string | null }>
    ).find((o) => o.slug === "demo");
    expect(demo).toBeTruthy();

    const created = await request(server)
      .post(`/saas/organizations/${demo!.id}/exports`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(202);
    expect(created.body.status).toBe("queued");
    const exportId = created.body.id as string;

    let status = "queued";
    for (let i = 0; i < 40; i++) {
      const ticket = await request(server)
        .get(`/saas/organizations/${demo!.id}/exports/${exportId}`)
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      status = ticket.body.status as string;
      if (status === "ready" || status === "failed") break;
      await new Promise((r) => setTimeout(r, 150));
    }
    expect(status).toBe("ready");

    const download = await request(server)
      .get(`/saas/organizations/${demo!.id}/exports/${exportId}/download`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);
    const text =
      typeof download.text === "string" && download.text.length > 0
        ? download.text
        : download.body.toString();
    const parsed = JSON.parse(text) as {
      organization: { id: string };
      users: Array<Record<string, unknown>>;
      companies: unknown[];
    };
    expect(parsed.organization.id).toBe(demo!.id);
    expect(Array.isArray(parsed.users)).toBe(true);
    expect(Array.isArray(parsed.companies)).toBe(true);
    const blob = JSON.stringify(parsed);
    expect(blob).not.toMatch(/passwordHash|password_hash|secret|vault/i);

    await request(server)
      .post(`/saas/organizations/${demo!.id}/exports`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
  }, 30_000);
});

/** Unique RUC with valid módulo-11 checksum (companies create requires it). */
function makeValidUniqueRuc(seed: number): string {
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
  const base = String(20_000_000_00 + (seed % 1_000_000_000)).padStart(10, "0").slice(0, 10);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(base[i]) * weights[i]!;
  }
  const mod = 11 - (sum % 11);
  const check = mod === 10 ? 0 : mod === 11 ? 1 : mod;
  return `${base}${check}`;
}
