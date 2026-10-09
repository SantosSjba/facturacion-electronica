import { Controller, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { text } from "express";
import request from "supertest";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  apiKeys,
  auditEvents,
  companies,
  createDb,
  documents,
  newId,
  organizations,
  webhookEndpoints,
  type Db,
} from "@factosys/db";
import { ApiKeyService, MACHINE_SCOPES } from "../src/infrastructure/api-keys/api-key.service";
import { Argon2Hasher } from "../src/infrastructure/crypto/argon2-hasher";
import { AuditService } from "../src/infrastructure/audit/audit.service";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";
import { CredentialsService } from "../src/infrastructure/credentials/credentials.service";
import { SeriesService } from "../src/infrastructure/series/series.service";
import { DocumentsService } from "../src/infrastructure/documents/documents.service";
import { PdfService } from "../src/infrastructure/pdf/pdf.service";
import type { ObjectStorageService } from "../src/infrastructure/storage/object-storage.service";
import { WebhooksService } from "../src/infrastructure/webhooks/webhooks.service";
import type { CredentialsVault } from "../src/infrastructure/crypto/credentials-vault";
import type { RateLimitService } from "../src/infrastructure/redis/rate-limit.service";
import type { AuthService } from "../src/infrastructure/auth/auth.service";
import { envSchema, type Env } from "../src/infrastructure/config/env.schema";
import { ApiKeysController } from "../src/interfaces/http/api-keys/api-keys.controller";
import { IntegratorCompaniesController } from "../src/interfaces/http/companies/integrator-companies.controller";
import { DocumentsController } from "../src/interfaces/http/v1/documents.controller";
import { WebhookEndpointsController } from "../src/interfaces/http/v1/webhook-endpoints.controller";
import { WhoamiController } from "../src/interfaces/http/v1/whoami.controller";
import { ApiKeyGuard } from "../src/interfaces/http/guards/api-key.guard";
import { JwtAuthGuard } from "../src/interfaces/http/guards/jwt-auth.guard";
import { PermissionsGuard } from "../src/interfaces/http/guards/permissions.guard";
import { AppExceptionFilter } from "../src/interfaces/http/filters/app-exception.filter";
import { ApiKeyAuth, RequireScopes } from "../src/interfaces/http/decorators/auth.decorators";

const emitted = vi.fn();
@Controller("v1")
@ApiKeyAuth()
class EmissionProbe {
  @Post("invoices")
  @RequireScopes("documents:write")
  emit() {
    emitted();
    return { ok: true };
  }
  @Post("previews/pdf")
  @RequireScopes("documents:write")
  preview() {
    emitted();
    return { ok: true };
  }
  @Post("documents/:id/shares")
  @RequireScopes("documents:share")
  share() {
    emitted();
    return { ok: true };
  }
}
const org = newId(),
  foreignOrg = newId(),
  a = newId(),
  b = newId(),
  prod = newId(),
  foreign = newId();
const docA = newId(),
  docB = newId(),
  hookA = newId(),
  hookB = newId(),
  globalHook = newId();
let app: INestApplication,
  db: Db,
  keys: ApiKeyService,
  admin: string,
  single: string,
  multi: string,
  reader: string;
const http = () => request(app.getHttpServer());
beforeAll(async () => {
  db = createDb("postgresql://factosys:factosys@localhost:5433/factosys");
  await db.insert(organizations).values([
    { id: org, name: "Company key test" },
    { id: foreignOrg, name: "Foreign fixture" },
  ]);
  await db.insert(companies).values([
    { id: a, organizationId: org, ruc: "20100070970", legalName: "A" },
    { id: b, organizationId: org, ruc: "20601234567", legalName: "B" },
    {
      id: prod,
      organizationId: org,
      ruc: "20100070970",
      legalName: "Production",
      environment: "production",
    },
    { id: foreign, organizationId: foreignOrg, ruc: "20100070970", legalName: "Foreign" },
  ]);
  await db.insert(documents).values([
    {
      id: docA,
      companyId: a,
      organizationId: org,
      documentType: "01",
      status: "draft",
      environment: "sandbox",
      payload: {},
      payloadHash: "a",
    },
    {
      id: docB,
      companyId: b,
      organizationId: org,
      documentType: "01",
      status: "draft",
      environment: "sandbox",
      payload: {},
      payloadHash: "b",
    },
  ]);
  await db.insert(webhookEndpoints).values(
    [
      { id: hookA, companyId: a },
      { id: hookB, companyId: b },
      { id: globalHook, companyId: null },
    ].map((row) => ({
      ...row,
      organizationId: org,
      url: "https://example.com/hook",
      events: ["document.status_changed"],
      secretHash: "fixture",
      secretHint: "test",
    })),
  );
  const hasher = new Argon2Hasher();
  keys = new ApiKeyService(db, hasher);
  const config = new ConfigService<Env, true>(envSchema.parse({ NODE_ENV: "test" }));
  const jwt = new JwtService();
  const auth = {
    buildUserContext: async () => ({
      kind: "user",
      organizationId: org,
      userId: newId(),
      email: "fixture@example.com",
      permissions: ["apikeys:manage", ...MACHINE_SCOPES],
      roles: ["owner"],
      ctx: "org",
    }),
  } as unknown as AuthService;
  admin = await jwt.signAsync(
    { typ: "access", org, sub: newId() },
    { secret: config.get("JWT_ACCESS_SECRET") },
  );
  const module = await Test.createTestingModule({
    controllers: [
      ApiKeysController,
      IntegratorCompaniesController,
      DocumentsController,
      WebhookEndpointsController,
      WhoamiController,
      EmissionProbe,
    ],
    providers: [
      { provide: ApiKeyService, useValue: keys },
      { provide: AuditService, useValue: new AuditService(db) },
      { provide: CompaniesService, useValue: new CompaniesService(db) },
      { provide: SeriesService, useValue: {} },
      { provide: CredentialsService, useValue: {} },
      { provide: DocumentsService, useValue: new DocumentsService(db, {} as ObjectStorageService) },
      { provide: PdfService, useValue: {} },
      {
        provide: WebhooksService,
        useValue: new WebhooksService(db, hasher, {} as CredentialsVault),
      },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.use(text({ type: "text/plain" }));
  const reflector = new Reflector();
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, jwt, config, auth),
    new ApiKeyGuard(
      reflector,
      keys,
      { consumeOrg: async () => undefined } as unknown as RateLimitService,
      jwt,
      config,
      auth,
      db,
    ),
    new PermissionsGuard(reflector),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  await app.init();
  single = (
    await http()
      .post("/organizations/me/api-keys")
      .auth(admin, { type: "bearer" })
      .send({ name: "A only", scopes: MACHINE_SCOPES, company_ids: [a] })
      .expect(201)
  ).body.secret;
  multi = (
    await http()
      .post("/organizations/me/api-keys")
      .auth(admin, { type: "bearer" })
      .send({ name: "A and B", scopes: MACHINE_SCOPES, company_ids: [a, b], access_mode: "multi" })
      .expect(201)
  ).body.secret;
  reader = (
    await keys.create({
      organizationId: org,
      name: "Reader",
      scopes: ["documents:read"],
      companyIds: [a],
    })
  ).secret;
});
afterAll(async () => {
  await app?.close();
  if (db) {
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, org));
    await db.delete(organizations).where(eq(organizations.id, org));
    await db.delete(organizations).where(eq(organizations.id, foreignOrg));
    await db.$client.end();
  }
});
it("creation requires an explicit emitter and explicit multi-company opt-in", async () => {
  for (const input of [
    {},
    { company_ids: [a, b] },
    { company_ids: [a, a], access_mode: "multi" },
    { company_ids: [] },
  ]) {
    await http()
      .post("/organizations/me/api-keys")
      .auth(admin, { type: "bearer" })
      .send({ name: "Invalid", scopes: ["documents:read"], ...input })
      .expect(400);
  }
  await http()
    .post("/organizations/me/api-keys")
    .auth(admin, { type: "bearer" })
    .send({ name: "Foreign", scopes: ["documents:read"], company_ids: [foreign] })
    .expect(400);
  await http()
    .post("/organizations/me/api-keys")
    .auth(admin, { type: "bearer" })
    .send({
      name: "Mismatch",
      scopes: ["documents:read"],
      company_ids: [prod],
      environment_constraint: "sandbox",
    })
    .expect(400);
});
it("lists only authorized companies and documents before pagination", async () => {
  expect(
    (await http().get("/v1/companies").auth(single, { type: "bearer" }).expect(200)).body.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([a]);
  const page = (
    await http().get("/v1/documents?limit=1").auth(single, { type: "bearer" }).expect(200)
  ).body;
  expect(page.items.map((row: { id: string }) => row.id)).toEqual([docA]);
  expect(page.next_cursor).toBeNull();
  await http().get(`/v1/documents?cursor=${docB}`).auth(single, { type: "bearer" }).expect(403);
  await http().get(`/v1/documents?company_id=${b}`).auth(single, { type: "bearer" }).expect(403);
});
it.each(["", "/xml", "/cdr", "/pdf", "/qr", "/qr.png", "/trace"])(
  "blocks foreign document reads and downloads %s",
  async (suffix) => {
    await http().get(`/v1/documents/${docB}${suffix}`).auth(single, { type: "bearer" }).expect(403);
  },
);
it("allows the second company only for a key explicitly assigned to both", async () => {
  await http().get(`/v1/documents/${docA}`).auth(single, { type: "bearer" }).expect(200);
  await http().get(`/v1/documents/${docB}`).auth(multi, { type: "bearer" }).expect(200);
  await http().get(`/v1/companies/${prod}`).auth(multi, { type: "bearer" }).expect(403);
  await http().post("/v1/companies").auth(multi, { type: "bearer" }).send({}).expect(403);
  await http().get(`/v1/companies/${b}`).auth(admin, { type: "bearer" }).expect(200);
});
it("blocks JSON, nested previews, TXT and share creation before execution", async () => {
  emitted.mockClear();
  await http()
    .post("/v1/invoices")
    .auth(single, { type: "bearer" })
    .send({ company_id: b })
    .expect(403);
  await http()
    .post("/v1/previews/pdf")
    .auth(single, { type: "bearer" })
    .send({ document: { company_id: b } })
    .expect(403);
  await http()
    .post("/v1/invoices")
    .auth(single, { type: "bearer" })
    .type("text/plain")
    .send(`FACTOSYS|1|01\nFIELD|company_id|"${b}"`)
    .expect(403);
  await http()
    .post(`/v1/documents/${docB}/shares`)
    .auth(single, { type: "bearer" })
    .send({ company_id: a })
    .expect(403);
  expect(emitted).not.toHaveBeenCalled();
  await http()
    .post("/v1/invoices")
    .auth(single, { type: "bearer" })
    .type("text/plain")
    .send(`FACTOSYS|1|01\nFIELD|company_id|"${a}"`)
    .expect(201);
  await http()
    .post("/v1/invoices")
    .auth(reader, { type: "bearer" })
    .send({ company_id: a })
    .expect(403);
});
it.each(["sol-credentials", "gre-credentials", "certificate"])(
  "blocks credentials on another company: %s",
  async (kind) => {
    await http()
      .put(`/v1/companies/${b}/${kind}`)
      .auth(single, { type: "bearer" })
      .send({})
      .expect(403);
  },
);
it("hides global webhooks and prevents accessing other emitters' endpoints", async () => {
  const list = (
    await http().get("/v1/webhook-endpoints").auth(single, { type: "bearer" }).expect(200)
  ).body;
  expect(list.map((row: { id: string }) => row.id)).toEqual([hookA]);
  for (const id of [hookB, globalHook]) {
    await http().get(`/v1/webhook-endpoints/${id}`).auth(single, { type: "bearer" }).expect(403);
    await http()
      .post(`/v1/webhook-endpoints/${id}/rotate-secret`)
      .auth(single, { type: "bearer" })
      .expect(403);
  }
  await http()
    .post("/v1/webhook-endpoints")
    .auth(single, { type: "bearer" })
    .send({ url: "https://example.com/hook" })
    .expect(403);
});
it("legacy keys fail closed until an administrator assigns companies without rotating secrets", async () => {
  const legacy = await keys.create({
    organizationId: org,
    name: "Legacy fixture",
    companyIds: [a],
    scopes: ["documents:read"],
  });
  await db.update(apiKeys).set({ companyIds: [] }).where(eq(apiKeys.id, legacy.id));
  await http().get("/v1/documents").auth(legacy.secret, { type: "bearer" }).expect(403);
  await http()
    .patch(`/organizations/me/api-keys/${legacy.id}/companies`)
    .auth(admin, { type: "bearer" })
    .send({ company_ids: [a] })
    .expect(200);
  await http().get("/v1/documents").auth(legacy.secret, { type: "bearer" }).expect(200);
  await http()
    .patch(`/organizations/me/api-keys/${legacy.id}/companies`)
    .auth(admin, { type: "bearer" })
    .send({ company_ids: [b] })
    .expect(200);
  await http().get(`/v1/documents/${docA}`).auth(legacy.secret, { type: "bearer" }).expect(403);
  await http().get(`/v1/documents/${docB}`).auth(legacy.secret, { type: "bearer" }).expect(200);
  await http()
    .patch(`/organizations/me/api-keys/${legacy.id}/companies`)
    .auth(single, { type: "bearer" })
    .send({ company_ids: [a] })
    .expect(401);
  await keys.revoke(org, legacy.id);
  await http().get("/v1/documents").auth(legacy.secret, { type: "bearer" }).expect(401);
  await expect(keys.assignCompanies(org, legacy.id, [a])).rejects.toMatchObject({
    httpStatus: 403,
  });
});
it("never returns or audits key secrets and exposes effective company IDs in whoami", async () => {
  const rows = (
    await http().get("/organizations/me/api-keys").auth(admin, { type: "bearer" }).expect(200)
  ).body;
  expect(JSON.stringify(rows)).not.toContain(single);
  expect(rows.some((row: { companyIds: string[] }) => row.companyIds.length === 2)).toBe(true);
  const audit = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.organizationId, org), eq(auditEvents.action, "api_key.created")));
  expect(audit.length).toBe(2);
  expect(JSON.stringify(audit)).not.toContain(single);
  expect(
    (await http().get("/v1/whoami").auth(single, { type: "bearer" }).expect(200)).body.company_ids,
  ).toEqual([a]);
});
