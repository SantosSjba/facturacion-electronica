import { afterAll, beforeAll, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  companies,
  createDb,
  documentSeries,
  newId,
  organizations,
  orgPlans,
  plans,
  type Db,
} from "@factosys/db";
import { CompaniesService } from "../src/infrastructure/companies/companies.service";

let db: Db;
let service: CompaniesService;
const orgIds = [newId(), newId(), newId()];
const planId = newId();
const zeroPlanId = newId();
const input = { ruc: "20100070970", legalName: "Quota fixture", environment: "sandbox" as const };

beforeAll(async () => {
  db = createDb(
    process.env.DATABASE_URL ?? "postgresql://factosys:factosys@localhost:5433/factosys",
  );
  service = new CompaniesService(db);
  await db.insert(plans).values([
    { id: planId, code: `quota-${planId}`, name: "Quota fixture", maxCompanies: 1 },
    { id: zeroPlanId, code: `quota-${zeroPlanId}`, name: "Zero quota fixture", maxCompanies: 0 },
  ]);
  await db
    .insert(organizations)
    .values(orgIds.map((id) => ({ id, name: "Company quota fixture", slug: `quota-${id}` })));
  await db.insert(orgPlans).values([
    { id: newId(), organizationId: orgIds[0], planId, status: "active" },
    { id: newId(), organizationId: orgIds[1], planId, status: "trialing" },
    { id: newId(), organizationId: orgIds[2], planId: zeroPlanId, status: "active" },
  ]);
});

afterAll(async () => {
  if (!db) return;
  await db.delete(organizations).where(inArray(organizations.id, orgIds));
  await db.delete(plans).where(inArray(plans.id, [planId, zeroPlanId]));
  await db.$client.end();
});

it("creates within quota and counts disabled companies and both environments", async () => {
  const created = await service.create(orgIds[0], input);
  const series = await db
    .select()
    .from(documentSeries)
    .where(eq(documentSeries.companyId, created.id));
  expect(series).toHaveLength(6);
  await service.patch(orgIds[0], created.id, { status: "disabled" });
  await expect(
    service.create(orgIds[0], { ...input, environment: "production" }),
  ).rejects.toMatchObject({
    httpStatus: 403,
    message: "Company plan limit reached",
  });
  expect(
    await db.select().from(companies).where(eq(companies.organizationId, orgIds[0])),
  ).toHaveLength(1);
  await expect(
    service.patch(orgIds[0], created.id, { legalName: "Updated fixture" }),
  ).resolves.toMatchObject({ legal_name: "Updated fixture" });
});

it("concurrent creations cannot exceed a trial plan quota", async () => {
  const results = await Promise.allSettled([
    service.create(orgIds[1], input),
    service.create(orgIds[1], { ...input, environment: "production" }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((result) => result.status === "rejected");
  expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
    httpStatus: 403,
    message: "Company plan limit reached",
  });
  expect(
    await db.select().from(companies).where(eq(companies.organizationId, orgIds[1])),
  ).toHaveLength(1);
});

it("zero quota blocks the first creation without inserting companies or series", async () => {
  await expect(service.create(orgIds[2], input)).rejects.toMatchObject({ httpStatus: 403 });
  expect(
    await db.select().from(companies).where(eq(companies.organizationId, orgIds[2])),
  ).toHaveLength(0);
  expect(
    await db.select().from(documentSeries).where(eq(documentSeries.organizationId, orgIds[2])),
  ).toHaveLength(0);
});
