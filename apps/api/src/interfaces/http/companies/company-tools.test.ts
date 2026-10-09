import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { loadPfx } from "@factosys/sunat-sign";
import type { Db } from "@factosys/db";
import { AppError } from "@factosys/shared";
import { CompanyToolsController, decodeBase64 } from "./company-tools.controller";
import { SaleQrController } from "../v1/sale-qr.controller";
import { CompaniesService } from "../../../infrastructure/companies/companies.service";
import { ApiKeyGuard } from "../guards/api-key.guard";
import { AppExceptionFilter } from "../filters/app-exception.filter";
import type { ApiKeyService } from "../../../infrastructure/api-keys/api-key.service";
import type { RateLimitService } from "../../../infrastructure/redis/rate-limit.service";
import type { AuthService } from "../../../infrastructure/auth/auth.service";
import { envSchema, type Env } from "../../../infrastructure/config/env.schema";
let app: INestApplication;
let generated: string;
const companyId = "00000000-0000-4000-8000-000000000001";
const companies = {
  requireCompany: vi.fn(async (org: string, id: string) => {
    if (org !== "org" || id !== companyId) throw AppError.notFound();
    return { ruc: "20100070970" };
  }),
};
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [CompanyToolsController, SaleQrController],
    providers: [{ provide: CompaniesService, useValue: companies }],
  }).compile();
  app = module.createNestApplication();
  const apiKeys = {
    authenticate: vi.fn(async (key: string) => ({
      kind: "api_key",
      organizationId: "org",
      apiKeyId: "key",
      companyIds: [companyId],
      scopes:
        key === "read"
          ? ["companies:read"]
          : ["credentials:manage", "companies:read", "companies:write", "documents:read"],
    })),
  };
  app.useGlobalGuards(
    new ApiKeyGuard(
      new Reflector(),
      apiKeys as unknown as ApiKeyService,
      { consumeOrg: vi.fn() } as unknown as RateLimitService,
      new JwtService(),
      new ConfigService<Env, true>(envSchema.parse({ NODE_ENV: "test" })),
      {} as AuthService,
      {
        select: () => ({
          from: () => ({ where: async () => [{ id: companyId, environment: "sandbox" }] }),
        }),
      } as unknown as Db,
    ),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  await app.init();
});
afterAll(async () => {
  await app.close();
});
it("requires authentication and credential scope for certificate utilities", async () => {
  await request(app.getHttpServer())
    .post("/v1/company-tools/certificate/free")
    .send({ password: "test-pass" })
    .expect(401);
  await request(app.getHttpServer())
    .post("/v1/company-tools/certificate/free")
    .auth("read", { type: "bearer" })
    .send({ password: "test-pass" })
    .expect(403);
});
it("generates a downloadable test PFX and converts its own key/certificate with no-cache headers", async () => {
  const response = await request(app.getHttpServer())
    .post("/v1/company-tools/certificate/free")
    .auth("full", { type: "bearer" })
    .send({ password: "test-pass" })
    .expect(200);
  generated = response.body.pfx;
  expect(response.body.test_only).toBe(true);
  expect(response.headers["cache-control"]).toBe("no-store");
  const loaded = loadPfx(Buffer.from(generated, "base64"), "test-pass");
  const converted = await request(app.getHttpServer())
    .post("/v1/company-tools/certificate")
    .auth("full", { type: "bearer" })
    .send({ cert: generated, cert_pass: "test-pass", base64: false })
    .expect(200);
  expect(converted.body.pem).toContain(loaded.privateKeyPem);
  expect(converted.body.cer).toBe(loaded.certificatePem);
});
it("rejects corrupt/noncanonical Base64 and prevents unsafe download filenames", async () => {
  for (const input of ["data:application/octet-stream;base64,YQ==", "YQ", "YR==", "YQ==\n", ""])
    expect(() => decodeBase64(input)).toThrow();
  await request(app.getHttpServer())
    .post("/v1/company-tools/base64/file")
    .auth("full", { type: "bearer" })
    .send({ base64: "YQ==", filename: "../unsafe.html" })
    .expect(422);
});
it("round-trips multipart binary bytes and forces download with nosniff", async () => {
  const bytes = Buffer.from([0, 255, 128, 10]);
  const encoded = await request(app.getHttpServer())
    .post("/v1/company-tools/file/base64")
    .auth("full", { type: "bearer" })
    .attach("file", bytes, "fixture.bin")
    .expect(200);
  expect(encoded.body.base64).toBe(bytes.toString("base64"));
  const decoded = await request(app.getHttpServer())
    .post("/v1/company-tools/base64/file")
    .auth("read", { type: "bearer" })
    .send({ base64: encoded.body.base64, filename: "fixture.bin" })
    .expect(200);
  expect(decoded.body).toEqual(bytes);
  expect(decoded.headers["x-content-type-options"]).toBe("nosniff");
});
it("rejects wrong PFX passwords without returning signing material", async () => {
  const response = await request(app.getHttpServer())
    .post("/v1/company-tools/certificate")
    .auth("full", { type: "bearer" })
    .send({ cert: generated, cert_pass: "wrong" });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.body.pem).toBeUndefined();
  expect(JSON.stringify(response.body)).not.toContain(generated);
});
it("generates PNG from supplied sale data and rejects other companies", async () => {
  const body = {
    company_id: companyId,
    tipo: "01",
    serie: "F001",
    numero: "15",
    emision: "2026-10-09",
    igv: 18,
    total: 118,
    clienteTipo: "6",
    clienteNumero: "20100070970",
  };
  const response = await request(app.getHttpServer())
    .post("/v1/sale/qr")
    .auth("full", { type: "bearer" })
    .send(body)
    .expect(200);
  expect(response.headers["content-type"]).toContain("image/png");
  expect(response.body.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await request(app.getHttpServer())
    .post("/v1/sale/qr")
    .auth("full", { type: "bearer" })
    .send({ ...body, company_id: "00000000-0000-4000-8000-000000000002" })
    .expect(403);
  await request(app.getHttpServer())
    .post("/v1/sale/qr")
    .auth("full", { type: "bearer" })
    .send({ ...body, numero: "0" })
    .expect(422);
});
