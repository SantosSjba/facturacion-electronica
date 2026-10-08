import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeAll, afterAll, expect, it } from "vitest";
import request from "supertest";
import { hash } from "argon2";
import { eq, inArray } from "drizzle-orm";
import {
  createDb,
  documents,
  newId,
  organizations,
  orgPlans,
  plans,
  roles,
  userRoles,
  users,
  type Db,
} from "@factosys/db";
import { E2eAppModule } from "./e2e-app.module";
import { monthWindow, withPlanCapacity } from "../src/infrastructure/saas/plan-capacity";
import { EmitDocumentOrchestrator } from "../src/infrastructure/documents/emit-document.orchestrator";

let app: INestApplication;
let db: Db;
let ownerToken: string;
let platformToken: string;
let memberId: string;
let keyId: string;
let companyId: string;
const orgId = newId(),
  platformOrgId = newId(),
  ownerId = newId(),
  operatorId = newId(),
  planId = newId();
const password = "QuotaTest!2026";
const platformBase = `/saas/organizations/${orgId}`;
const memberEmail = `${newId()}@factosysperu.com`;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.EMAIL_DRIVER = "log";
  const module = await Test.createTestingModule({ imports: [E2eAppModule] }).compile();
  app = module.createNestApplication({ logger: false });
  await app.init();
  db = createDb(
    process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
  );
  await db
    .insert(plans)
    .values({
      id: planId,
      code: `all-quota-${planId}`,
      name: "All quota fixture",
      maxCompanies: 1,
      maxUsers: 2,
      maxApiKeys: 1,
      maxDocumentsPerMonth: 1,
    });
  await db.insert(organizations).values([
    { id: orgId, name: "All quota fixture", slug: `quota-${orgId}` },
    { id: platformOrgId, name: "Quota platform fixture", slug: `quota-${platformOrgId}` },
  ]);
  await db
    .insert(orgPlans)
    .values({ id: newId(), organizationId: orgId, planId, status: "active" });
  const passwordHash = await hash(password);
  await db.insert(users).values([
    {
      id: ownerId,
      organizationId: orgId,
      email: `${ownerId}@factosysperu.com`,
      name: "Quota owner",
      passwordHash,
    },
    {
      id: operatorId,
      organizationId: platformOrgId,
      email: `${operatorId}@factosysperu.com`,
      name: "Quota operator",
      passwordHash,
    },
  ]);
  const roleRows = await db
    .select()
    .from(roles)
    .where(inArray(roles.code, ["owner", "platform_superadmin"]));
  const ownerRole = roleRows.find((r) => r.code === "owner");
  const platformRole = roleRows.find((r) => r.code === "platform_superadmin");
  if (!ownerRole || !platformRole) throw new Error("RBAC fixture roles are missing");
  await db.insert(userRoles).values([
    { userId: ownerId, roleId: ownerRole.id },
    { userId: operatorId, roleId: platformRole.id },
  ]);
  for (const id of [ownerId, operatorId]) {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: `${id}@factosysperu.com`, password })
      .expect(200);
    if (id === ownerId) ownerToken = login.body.access_token;
    else platformToken = login.body.access_token;
  }
}, 20_000);

afterAll(async () => {
  if (db) {
    await db.delete(organizations).where(inArray(organizations.id, [orgId, platformOrgId]));
    await db.delete(plans).where(eq(plans.id, planId));
    await db.$client.end();
  }
  if (app) await app.close();
});

it("client creates a usable account directly with no invitation and reaches user quota", async () => {
  const created = await request(app.getHttpServer())
    .post("/organizations/me/users")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: memberEmail, name: "Quota member", password, roles: ["viewer"] })
    .expect(201);
  memberId = created.body.id;
  expect(created.body.status).toBe("active");
  expect(created.body).not.toHaveProperty("passwordHash");
  await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: memberEmail, password })
    .expect(200);
  const blocked = await request(app.getHttpServer())
    .post("/organizations/me/users")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: `${newId()}@factosysperu.com`, name: "Over quota", password, roles: ["viewer"] })
    .expect(403);
  expect(blocked.body.message).toBe("User plan limit reached");
  await request(app.getHttpServer())
    .post("/organizations/me/users")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: `${newId()}@factosysperu.com`, name: "Invite", invite: true, roles: ["viewer"] })
    .expect(400);
});

it("platform manages organization users with audit and tenant isolation", async () => {
  const list = await request(app.getHttpServer())
    .get(`${platformBase}/users`)
    .set("Authorization", `Bearer ${platformToken}`)
    .expect(200);
  expect(list.body).toHaveLength(2);
  await request(app.getHttpServer())
    .get(`${platformBase}/users`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .expect(403);
  const changed = await request(app.getHttpServer())
    .patch(`${platformBase}/users/${memberId}`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({
      name: "Updated member",
      roles: ["admin"],
      status: "disabled",
      password: "NewQuotaPass!2026",
    })
    .expect(200);
  expect(changed.body).toMatchObject({
    name: "Updated member",
    status: "disabled",
    roles: ["admin"],
  });
  await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: memberEmail, password: "NewQuotaPass!2026" })
    .expect(401);
  await request(app.getHttpServer())
    .patch(`${platformBase}/users/${memberId}`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ status: "active" })
    .expect(200);
  await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: memberEmail, password: "NewQuotaPass!2026" })
    .expect(200);
  await request(app.getHttpServer())
    .patch(`${platformBase}/users/${operatorId}`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ status: "disabled" })
    .expect(404);
  await request(app.getHttpServer())
    .post(`${platformBase}/users`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ email: `${newId()}@factosysperu.com`, name: "Over quota", password, roles: ["viewer"] })
    .expect(403);
});

it("last owner and platform roles remain protected", async () => {
  await request(app.getHttpServer())
    .patch(`${platformBase}/users/${ownerId}`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ status: "disabled", name: "Must not change" })
    .expect(409);
  await request(app.getHttpServer())
    .put(`${platformBase}/users/${ownerId}/roles`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ roles: ["viewer"] })
    .expect(409);
  await request(app.getHttpServer())
    .put(`${platformBase}/users/${memberId}/roles`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ roles: ["platform_superadmin"] })
    .expect(403);
  const [owner] = await db.select().from(users).where(eq(users.id, ownerId));
  expect(owner?.name).toBe("Quota owner");
});

it("key quota blocks another key and revocation releases capacity", async () => {
  const created = await request(app.getHttpServer())
    .post("/organizations/me/api-keys")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Quota key", scopes: ["documents:read"] })
    .expect(201);
  keyId = created.body.id;
  await request(app.getHttpServer())
    .post("/organizations/me/api-keys")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Extra key", scopes: ["documents:read"] })
    .expect(403);
  await request(app.getHttpServer())
    .delete(`/organizations/me/api-keys/${keyId}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .expect(200);
  await request(app.getHttpServer())
    .post("/organizations/me/api-keys")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Replacement key", scopes: ["documents:read"] })
    .expect(201);
});

it("monthly document quota ignores last month and serializes concurrent inserts", async () => {
  const created = await request(app.getHttpServer())
    .post("/companies")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ ruc: "20100070970", legal_name: "Quota company", environment: "sandbox" })
    .expect(201);
  companyId = created.body.id;
  const row = {
    organizationId: orgId,
    companyId,
    documentType: "01",
    status: "draft",
    environment: "sandbox",
    payload: {},
    payloadHash: "fixture",
  };
  await db
    .insert(documents)
    .values({ ...row, id: newId(), createdAt: new Date(monthWindow().start.getTime() - 1000) });
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      withPlanCapacity(db, orgId, "documents_this_month", async (tx) =>
        tx.insert(documents).values({ ...row, id: newId() }),
      ),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((r) => r.status === "rejected");
  expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
    httpStatus: 403,
    message: "Monthly document plan limit reached",
  });
  const usage = await request(app.getHttpServer())
    .get(`${platformBase}/plan-usage`)
    .set("Authorization", `Bearer ${platformToken}`)
    .expect(200);
  expect(usage.body.usage).toMatchObject({
    companies: 1,
    users: 2,
    api_keys: 1,
    documents_this_month: 1,
  });
  let built = false;
  await expect(
    app.get(EmitDocumentOrchestrator).execute({
      organizationId: orgId,
      companyId,
      documentType: "01",
      serie: "F001",
      issueDate: "2026-10-08",
      currency: "PEN",
      customer: { identity_type: "6", identity_number: "20100070970", name: "Quota fixture" },
      payload: {},
      idempotencyKey: newId(),
      build: async () => {
        built = true;
        throw new Error("Quota should block before building");
      },
    }),
  ).rejects.toMatchObject({ httpStatus: 403, message: "Monthly document plan limit reached" });
  expect(built).toBe(false);
});
