import { type INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { S3Client } from "@aws-sdk/client-s3";
import {
  companies,
  createDb,
  newId,
  organizations,
  documentSeries,
  documentArtifacts,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";
import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompanyLogoController } from "../src/interfaces/http/companies/company-logo.controller";
import {
  CompanyLogoService,
  MAX_LOGO_BYTES,
} from "../src/infrastructure/companies/company-logo.service";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";
import { ObjectStorageService } from "../src/infrastructure/storage/object-storage.service";
import { DB } from "../src/infrastructure/persistence/db.tokens";
import { ApiKeyGuard } from "../src/interfaces/http/guards/api-key.guard";
import { AppExceptionFilter } from "../src/interfaces/http/filters/app-exception.filter";
import type { ApiKeyService } from "../src/infrastructure/api-keys/api-key.service";
import type { RateLimitService } from "../src/infrastructure/redis/rate-limit.service";
import type { AuthService } from "../src/infrastructure/auth/auth.service";
import { EmitDocumentOrchestrator } from "../src/infrastructure/documents/emit-document.orchestrator";
import { DocumentsService } from "../src/infrastructure/documents/documents.service";
import { SeriesService } from "../src/infrastructure/series/series.service";
import { PdfService } from "../src/infrastructure/pdf/pdf.service";
import type { CredentialsResolver } from "../src/infrastructure/documents/credentials-resolver";
import type { QueueProducer } from "../src/infrastructure/queues/queue.producer";
import { envSchema, type Env } from "../src/infrastructure/config/env.schema";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

// Real Postgres + MinIO + HTTP upload; identities are isolated fixtures handled by the real guard.
describe("company logo HTTP integration", () => {
  let app: INestApplication;
  let db: Db;
  let storage: ObjectStorageService;
  let s3: S3Client;
  let png: Buffer;
  let jwtToken: string;
  const orgId = newId();
  const otherOrgId = newId();
  const companyId = newId();
  const otherCompanyId = newId();
  const keys: string[] = [];
  const emittedIds: string[] = [];
  const scopes: Record<string, string[]> = {
    fsys_logo_owner: ["companies:read", "companies:write"],
    fsys_logo_reader: ["companies:read"],
    fsys_logo_documents: ["documents:read", "documents:write"],
  };
  const url = `/v1/companies/${companyId}/logo`;

  beforeAll(async () => {
    db = createDb(
      process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
    );
    await db.insert(organizations).values(
      [orgId, otherOrgId].map((id) => ({
        id,
        name: "Logo integration fixture",
        slug: `logo-${id}`,
      })),
    );
    await db.insert(companies).values([
      { id: companyId, organizationId: orgId, ruc: "20100070970", legalName: "Logo fixture" },
      {
        id: otherCompanyId,
        organizationId: otherOrgId,
        ruc: "20100070970",
        legalName: "Other tenant fixture",
      },
    ]);
    await db.insert(documentSeries).values(
      [
        { documentType: "01", serie: "F001" },
        { documentType: "03", serie: "B001" },
        { documentType: "07", serie: "FC01" },
        { documentType: "08", serie: "FD01" },
      ].map((entry) => ({ id: newId(), organizationId: orgId, companyId, ...entry })),
    );
    const config = new ConfigService<Env, true>(
      envSchema.parse({
        NODE_ENV: "test",
        MINIO_BUCKET: process.env.MINIO_BUCKET ?? "factosys-dev",
        MINIO_PRESIGN_TTL_SEC: 300,
        JWT_ACCESS_SECRET: "logo-test-access-secret-32-bytes!!",
      }),
    );
    s3 = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
      region: process.env.MINIO_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? "factosys",
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? "factosysdev",
      },
    });
    storage = new ObjectStorageService(s3, config);
    await storage.ensureBucket();
    const module = await Test.createTestingModule({
      controllers: [CompanyLogoController],
      providers: [
        CompanyLogoService,
        CompaniesService,
        { provide: DB, useValue: db },
        { provide: ObjectStorageService, useValue: storage },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    const jwt = new JwtService();
    const user = {
      kind: "user",
      organizationId: orgId,
      userId: "fixture",
      permissions: scopes.fsys_logo_owner,
      roles: ["owner"],
      ctx: "org",
      email: "logo@example.com",
    };
    const guard = new ApiKeyGuard(
      new Reflector(),
      {
        authenticate: async (secret: string) => {
          if (!scopes[secret]) throw AppError.unauthorized();
          return {
            kind: "api_key",
            organizationId: orgId,
            apiKeyId: "fixture",
            companyIds: [companyId],
            scopes: scopes[secret],
          };
        },
      } as unknown as ApiKeyService,
      { consumeOrg: async () => undefined } as unknown as RateLimitService,
      jwt,
      config,
      { buildUserContext: async () => user } as unknown as AuthService,
      db,
    );
    app.useGlobalGuards(guard);
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    jwtToken = await jwt.signAsync(
      { sub: "fixture", org: orgId, typ: "access" },
      { secret: config.get("JWT_ACCESS_SECRET") },
    );
    png = await sharp({
      create: {
        width: 80,
        height: 40,
        channels: 4,
        background: { r: 10, g: 30, b: 200, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db && storage) {
      const artifacts = await db
        .select()
        .from(documentArtifacts)
        .where(eq(documentArtifacts.organizationId, orgId));
      for (const artifact of artifacts) if (artifact.objectKey) keys.push(artifact.objectKey);
    }
    for (const key of keys) await storage.deleteObject(key);
    if (s3) s3.destroy();
    if (db) {
      await db.delete(organizations).where(inArray(organizations.id, [orgId, otherOrgId]));
      await db.$client.end();
    }
  });

  it("requires credentials and company scopes for integrations", async () => {
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer())
      .get(url)
      .auth("fsys_logo_documents", { type: "bearer" })
      .expect(403);
    await request(app.getHttpServer())
      .put(url)
      .auth("fsys_logo_reader", { type: "bearer" })
      .attach("file", png, "logo.png")
      .expect(403);
    await request(app.getHttpServer())
      .delete(url)
      .auth("fsys_logo_reader", { type: "bearer" })
      .expect(403);
  });

  it("starts without a logo", async () => {
    const response = await request(app.getHttpServer())
      .get(url)
      .auth("fsys_logo_reader", { type: "bearer" })
      .expect(200);
    expect(response.body).toEqual({ logo: null, data_url: null });
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("documents multipart upload and preview responses for integrators", () => {
    const schema = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    const endpoint = schema.paths["/v1/companies/{companyId}/logo"];
    expect(endpoint?.get?.responses["200"]).toHaveProperty(
      "content.application/json.schema.properties.data_url",
    );
    expect(endpoint?.put?.requestBody).toHaveProperty(
      "content.multipart/form-data.schema.properties.file.format",
      "binary",
    );
    expect(endpoint?.delete?.responses["204"]).toBeDefined();
  });

  it("uploads through the portal JWT and reads through an API key", async () => {
    const uploaded = await request(app.getHttpServer())
      .put(`/companies/${companyId}/logo`)
      .auth(jwtToken, { type: "bearer" })
      .attach("file", png, { filename: "logo.png", contentType: "image/png" })
      .expect(200);
    expect(uploaded.body.logo).toMatchObject({ content_type: "image/png", width: 80, height: 40 });
    expect(uploaded.body.data_url).toMatch(/^data:image\/png;base64,/);
    expect(uploaded.body.logo.objectKey).toBeUndefined();
    const [row] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!row?.logo) throw new Error("Uploaded logo was not persisted");
    keys.push(row.logo.objectKey);
    expect(await storage.getObject(row.logo.objectKey)).toEqual(
      Buffer.from(uploaded.body.data_url.split(",")[1], "base64"),
    );
    const got = await request(app.getHttpServer())
      .get(url)
      .auth("fsys_logo_reader", { type: "bearer" })
      .expect(200);
    expect(got.body).toEqual(uploaded.body);
    const company = await app.get(CompaniesService).get(orgId, companyId);
    expect(company.logo?.sha256).toBe(uploaded.body.logo.sha256);
  });

  it("rejects missing, corrupt, oversized and cross-tenant uploads without changing the logo", async () => {
    const current = await app.get(CompanyLogoService).get(orgId, companyId);
    await request(app.getHttpServer())
      .put(url)
      .auth("fsys_logo_owner", { type: "bearer" })
      .expect(400);
    await request(app.getHttpServer())
      .put(url)
      .auth("fsys_logo_owner", { type: "bearer" })
      .attach("file", Buffer.from("invalid PNG"), "logo.png")
      .expect(400);
    await request(app.getHttpServer())
      .put(url)
      .auth("fsys_logo_owner", { type: "bearer" })
      .attach("file", Buffer.alloc(MAX_LOGO_BYTES + 1), "huge.png")
      .expect(413);
    for (const method of ["get", "put", "delete"] as const) {
      const req = request(app.getHttpServer())
        [method](`/v1/companies/${otherCompanyId}/logo`)
        .auth("fsys_logo_owner", { type: "bearer" });
      if (method === "put") req.attach("file", png, "logo.png");
      await req.expect(403);
    }
    expect(await app.get(CompanyLogoService).get(orgId, companyId)).toEqual(current);
  });

  it("persists the logo at emission for invoices, receipts and notes", async () => {
    const companiesService = app.get(CompaniesService);
    const docs = new DocumentsService(db, storage);
    const queues = { enqueue: async () => undefined } as unknown as QueueProducer;
    const credentials = {
      resolveCertificate: async () => ({ pfx: Buffer.from("fixture"), password: "fixture" }),
      resolveSol: async () => ({ username: "fixture", password: "fixture" }),
    } as unknown as CredentialsResolver;
    const emitter = new EmitDocumentOrchestrator(
      db,
      companiesService,
      new SeriesService(db, companiesService),
      docs,
      credentials,
      queues,
    );
    const original = await companiesService.requireCompany(orgId, companyId);
    for (const [documentType, serie] of [
      ["01", "F001"],
      ["03", "B001"],
      ["07", "FC01"],
      ["08", "FD01"],
    ] as const) {
      const emitted = await emitter.execute({
        organizationId: orgId,
        companyId,
        documentType,
        serie,
        issueDate: "2026-10-08",
        currency: "PEN",
        customer: { identity_type: "6", identity_number: "20100070970", name: "Fixture customer" },
        payload: {
          lines: [
            {
              description: "Logo integration fixture",
              quantity: "1",
              unit_value: "100.00",
              tax_amount: "18.00",
            },
          ],
        },
        idempotencyKey: newId(),
        build: async ({ allocated }) => ({
          serie,
          ...allocated,
          totals: { total: "118.00", igv: "18.00" },
          signedXml: "<DigestValue>abc=</DigestValue>",
          zipBytes: Buffer.from("zip fixture"),
        }),
      });
      emittedIds.push(emitted.id);
      expect((await docs.getById(orgId, emitted.id)).logoSnapshot?.logo?.objectKey).toBe(
        original.logo?.objectKey,
      );
    }
  });

  it("replaces the logo, keeps the historical version readable and deletes the configuration", async () => {
    const original = keys[0];
    if (!original) throw new Error("Original logo was not uploaded");
    const jpeg = await sharp({ create: { width: 30, height: 60, channels: 3, background: "red" } })
      .jpeg()
      .toBuffer();
    const response = await request(app.getHttpServer())
      .put(url)
      .auth("fsys_logo_owner", { type: "bearer" })
      .attach("file", jpeg, "new.jpg")
      .expect(200);
    expect(response.body.logo).toMatchObject({ width: 30, height: 60, content_type: "image/png" });
    const [row] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!row?.logo) throw new Error("Replaced logo was not persisted");
    keys.push(row.logo.objectKey);
    expect(row.logo.objectKey).not.toBe(original);
    expect((await storage.getObject(original)).length).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .delete(url)
      .auth("fsys_logo_owner", { type: "bearer" })
      .expect(204);
    const cleared = await request(app.getHttpServer())
      .get(url)
      .auth("fsys_logo_reader", { type: "bearer" })
      .expect(200);
    expect(cleared.body).toEqual({ logo: null, data_url: null });
    await request(app.getHttpServer())
      .delete(url)
      .auth("fsys_logo_owner", { type: "bearer" })
      .expect(204);
  });

  it("generates historical PDFs from the original logo after the company logo is deleted", async () => {
    const docs = new DocumentsService(db, storage);
    const pdf = new PdfService(
      docs,
      app.get(CompaniesService),
      {} as QueueProducer,
      new ConfigService<Env, true>(
        envSchema.parse({ NODE_ENV: "test", PDF_RI_MODE: "playwright" }),
      ),
      app.get(CompanyLogoService),
    );
    expect(emittedIds).toHaveLength(4);
    for (const documentId of emittedIds) {
      const bytes = await pdf.renderAndStore(orgId, documentId);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      // Chromium embeds the company PNG as an image XObject in each PDF.
      expect(bytes.toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
      expect((await pdf.renderAndStore(orgId, documentId)).equals(bytes)).toBe(true);
    }
  }, 30_000);
});
