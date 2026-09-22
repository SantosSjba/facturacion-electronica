import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { App } from "supertest/types";

import { E2eAppModule } from "./e2e-app.module";

describe("API e2e", () => {
  let app: INestApplication;
  let server: App;
  let accessToken: string;
  let apiKeySecret: string;

  beforeAll(async () => {
    process.env["NODE_ENV"] = "test";
    process.env["LOG_LEVEL"] = "silent";
    process.env["JWT_ACCESS_SECRET"] =
      process.env["JWT_ACCESS_SECRET"] ?? "test-jwt-access-secret-32bytes!!";
    process.env["RATE_LIMIT_RPM_DEFAULT"] = "5000";

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
});
