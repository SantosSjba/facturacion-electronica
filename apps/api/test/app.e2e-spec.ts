import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { App } from "supertest/types";

import { E2eAppModule } from "./e2e-app.module";

describe("API e2e", () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    process.env["NODE_ENV"] = "test";
    process.env["LOG_LEVEL"] = "silent";

    const moduleRef = await Test.createTestingModule({
      imports: [E2eAppModule],
    }).compile();

    app = moduleRef.createNestApplication({
      bufferLogs: true,
      logger: false,
    });
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 JSON", async () => {
    const res = await request(server).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("GET /ready returns stub 200 JSON", async () => {
    const res = await request(server).get("/ready").expect(200);
    expect(res.body).toEqual({
      status: "ok",
      checks: { database: "skipped", redis: "skipped" },
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
});
