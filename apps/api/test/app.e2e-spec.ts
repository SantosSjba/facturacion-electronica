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
    await app.close();
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
});
