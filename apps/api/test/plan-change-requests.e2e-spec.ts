import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { hash } from "argon2";
import { eq, inArray } from "drizzle-orm";
import {
  createDb,
  newId,
  organizations,
  orgPlans,
  planChangeRequests,
  plans,
  roles,
  userRoles,
  users,
  type Db,
} from "@factosys/db";
import { E2eAppModule } from "./e2e-app.module";

let app: INestApplication;
let db: Db;
let clientToken: string;
let platformToken: string;
let requestedPlanCode: string;
let requestedPlanId: string;
let pendingId: string;
const orgId = newId();
const otherOrgId = newId();
const ownerId = newId();
const operatorId = newId();
const otherUserId = newId();
const retiredPlanId = newId();
const password = "PlanRequestsTest!2026";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.EMAIL_DRIVER = "log";
  const moduleRef = await Test.createTestingModule({ imports: [E2eAppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  db = createDb(
    process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
  );
  const [plan] = await db.select().from(plans).where(eq(plans.isActive, true)).limit(1);
  if (!plan) throw new Error("Run pnpm db:seed before this integration test");
  requestedPlanCode = plan.code;
  requestedPlanId = plan.id;
  await db.insert(organizations).values([
    { id: orgId, name: "Plan request test", slug: `plan-request-${orgId}` },
    { id: otherOrgId, name: "Other plan request test", slug: `plan-request-${otherOrgId}` },
  ]);
  const passwordHash = await hash(password);
  await db.insert(users).values([
    {
      id: ownerId,
      organizationId: orgId,
      name: "Test owner",
      email: `${ownerId}@factosysperu.com`,
      passwordHash,
    },
    {
      id: operatorId,
      organizationId: orgId,
      name: "Test platform",
      email: `${operatorId}@factosysperu.com`,
      passwordHash,
    },
    {
      id: otherUserId,
      organizationId: otherOrgId,
      name: "Other owner",
      email: `${otherUserId}@factosysperu.com`,
      passwordHash,
    },
  ]);
  const roleRows = await db
    .select()
    .from(roles)
    .where(inArray(roles.code, ["owner", "platform_superadmin"]));
  const ownerRole = roleRows.find((role) => role.code === "owner");
  const platformRole = roleRows.find((role) => role.code === "platform_superadmin");
  if (!ownerRole || !platformRole) throw new Error("Seed RBAC roles are missing");
  await db.insert(userRoles).values([
    { userId: ownerId, roleId: ownerRole.id },
    { userId: operatorId, roleId: platformRole.id },
  ]);
  await db.insert(planChangeRequests).values({
    id: newId(),
    organizationId: otherOrgId,
    requestedByUserId: otherUserId,
    requestedPlanId: plan.id,
    status: "closed",
    message: "Closed fixture",
  });
  const clientLogin = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: `${ownerId}@factosysperu.com`, password })
    .expect(200);
  clientToken = clientLogin.body.access_token as string;
  const platformLogin = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: `${operatorId}@factosysperu.com`, password })
    .expect(200);
  platformToken = platformLogin.body.access_token as string;
}, 20_000);

afterAll(async () => {
  if (db) {
    await db.delete(organizations).where(inArray(organizations.id, [orgId, otherOrgId]));
    await db.delete(plans).where(eq(plans.id, retiredPlanId));
    await db.$client.end();
  }
  if (app) await app.close();
});

it("client submission is immediately visible to platform with organization and message", async () => {
  const created = await request(app.getHttpServer())
    .post("/organizations/me/plan/change-requests")
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ requested_plan_code: requestedPlanCode, message: "Integration test request" })
    .expect(201);
  pendingId = created.body.id as string;
  const listed = await request(app.getHttpServer())
    .get(`/saas/platform/plan-change-requests?organization_id=${orgId}&status=pending`)
    .set("Authorization", `Bearer ${platformToken}`)
    .expect(200);
  expect(listed.body.total).toBe(1);
  expect(listed.body.items[0]).toMatchObject({
    id: pendingId,
    organization_id: orgId,
    status: "pending",
    message: "Integration test request",
    requested_plan_code: requestedPlanCode,
  });
});

it("platform filters closed requests and validates pagination", async () => {
  const listed = await request(app.getHttpServer())
    .get(
      `/saas/platform/plan-change-requests?organization_id=${otherOrgId}&status=closed&page_size=1`,
    )
    .set("Authorization", `Bearer ${platformToken}`)
    .expect(200);
  expect(listed.body.total).toBe(1);
  expect(listed.body.items[0].message).toBe("Closed fixture");
  const next = await request(app.getHttpServer())
    .get(`/saas/platform/plan-change-requests?organization_id=${otherOrgId}&page_size=1&page=2`)
    .set("Authorization", `Bearer ${platformToken}`)
    .expect(200);
  expect(next.body.items).toEqual([]);
  await request(app.getHttpServer())
    .get("/saas/platform/plan-change-requests?page=0")
    .set("Authorization", `Bearer ${platformToken}`)
    .expect(400);
});

it("tenant and anonymous callers cannot read cross-organization requests", async () => {
  await request(app.getHttpServer())
    .get("/saas/platform/plan-change-requests")
    .set("Authorization", `Bearer ${clientToken}`)
    .expect(403);
  await request(app.getHttpServer()).get("/saas/platform/plan-change-requests").expect(401);
});

it("approval applies the requested plan, closes the request and notifies the client", async () => {
  await request(app.getHttpServer())
    .post(`/saas/platform/plan-change-requests/${pendingId}/resolve`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ decision: "approve", note: "Listo para usar" })
    .expect(201);
  const [resolved] = await db
    .select()
    .from(planChangeRequests)
    .where(eq(planChangeRequests.id, pendingId));
  expect(resolved).toMatchObject({
    status: "closed",
    resolution: "approved",
    resolutionNote: "Listo para usar",
    resolvedByUserId: operatorId,
  });
  expect(resolved?.assignedOrgPlanId).toBeTruthy();
  const current = await request(app.getHttpServer())
    .get("/organizations/me/plan")
    .set("Authorization", `Bearer ${clientToken}`)
    .expect(200);
  expect(current.body.plan.id).toBe(requestedPlanId);
  const history = await request(app.getHttpServer())
    .get("/organizations/me/plan/change-requests")
    .set("Authorization", `Bearer ${clientToken}`)
    .expect(200);
  expect(history.body.items[0]).toMatchObject({
    resolution: "approved",
    resolution_note: "Listo para usar",
  });
  const inbox = await request(app.getHttpServer())
    .get("/organizations/me/notifications")
    .set("Authorization", `Bearer ${clientToken}`)
    .expect(200);
  expect(
    inbox.body.items.some((item: { title: string }) => item.title === "Cambio de plan aprobado"),
  ).toBe(true);
  await request(app.getHttpServer())
    .post(`/saas/platform/plan-change-requests/${pendingId}/resolve`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ decision: "approve" })
    .expect(409);
  expect((await db.select().from(orgPlans).where(eq(orgPlans.organizationId, orgId))).length).toBe(
    1,
  );
});

it("assigning the same plan from the organization closes the matching open request", async () => {
  const id = newId();
  await db
    .insert(planChangeRequests)
    .values({
      id,
      organizationId: otherOrgId,
      requestedByUserId: otherUserId,
      requestedPlanId,
      status: "acknowledged",
    });
  const assigned = await request(app.getHttpServer())
    .post("/saas/org-plans")
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ organization_id: otherOrgId, plan_id: requestedPlanId })
    .expect(201);
  expect(assigned.body.resolved_change_request_ids).toContain(id);
  const [resolved] = await db
    .select()
    .from(planChangeRequests)
    .where(eq(planChangeRequests.id, id));
  expect(resolved).toMatchObject({
    resolution: "approved",
    status: "closed",
    assignedOrgPlanId: assigned.body.id,
  });
});

it("rejection requires a reason and leaves the organization plan unchanged", async () => {
  const id = newId();
  await db
    .insert(planChangeRequests)
    .values({ id, organizationId: otherOrgId, requestedByUserId: otherUserId, requestedPlanId });
  const before = await db.select().from(orgPlans).where(eq(orgPlans.organizationId, otherOrgId));
  await request(app.getHttpServer())
    .post(`/saas/platform/plan-change-requests/${id}/resolve`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ decision: "reject" })
    .expect(400);
  await request(app.getHttpServer())
    .post(`/saas/platform/plan-change-requests/${id}/resolve`)
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ decision: "reject", note: "Unauthorized" })
    .expect(403);
  await request(app.getHttpServer())
    .post(`/saas/platform/plan-change-requests/${id}/resolve`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ decision: "reject", note: "Necesitamos verificar la empresa" })
    .expect(201);
  const [resolved] = await db
    .select()
    .from(planChangeRequests)
    .where(eq(planChangeRequests.id, id));
  expect(resolved).toMatchObject({
    resolution: "rejected",
    resolutionNote: "Necesitamos verificar la empresa",
    status: "closed",
  });
  expect(await db.select().from(orgPlans).where(eq(orgPlans.organizationId, otherOrgId))).toEqual(
    before,
  );
});

it("concurrent decisions only resolve once", async () => {
  const id = newId();
  await db
    .insert(planChangeRequests)
    .values({ id, organizationId: otherOrgId, requestedByUserId: otherUserId, requestedPlanId });
  const responses = await Promise.all(
    ["approve", "reject"].map((decision) =>
      request(app.getHttpServer())
        .post(`/saas/platform/plan-change-requests/${id}/resolve`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ decision, note: "Concurrent test" }),
    ),
  );
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  const [resolved] = await db
    .select()
    .from(planChangeRequests)
    .where(eq(planChangeRequests.id, id));
  expect(resolved?.status).toBe("closed");
  expect(resolved?.resolvedAt).toBeTruthy();
});

it("inactive requested plans cannot be approved, and assigning another plan leaves the request open", async () => {
  const id = newId();
  await db
    .insert(plans)
    .values({
      id: retiredPlanId,
      code: `retired-${retiredPlanId}`,
      name: "Retired test plan",
      isActive: false,
    });
  await db
    .insert(planChangeRequests)
    .values({
      id,
      organizationId: otherOrgId,
      requestedByUserId: otherUserId,
      requestedPlanId: retiredPlanId,
    });
  const before = await db.select().from(orgPlans).where(eq(orgPlans.organizationId, otherOrgId));
  await request(app.getHttpServer())
    .post(`/saas/platform/plan-change-requests/${id}/resolve`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ decision: "approve" })
    .expect(404);
  expect(await db.select().from(orgPlans).where(eq(orgPlans.organizationId, otherOrgId))).toEqual(
    before,
  );
  await request(app.getHttpServer())
    .post("/saas/org-plans")
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ organization_id: otherOrgId, plan_id: requestedPlanId })
    .expect(201);
  const [open] = await db.select().from(planChangeRequests).where(eq(planChangeRequests.id, id));
  expect(open).toMatchObject({ status: "pending", resolution: null });
});
