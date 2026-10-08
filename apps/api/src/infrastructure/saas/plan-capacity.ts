import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import {
  apiKeys,
  companies,
  documents,
  organizations,
  orgPlans,
  plans,
  users,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

export type PlanResource = "companies" | "users" | "api_keys" | "documents_this_month";
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function assertPlanCapacity(db: Db, organizationId: string, resource: PlanResource) {
  return withPlanCapacity(db, organizationId, resource, async () => undefined);
}

export function monthWindow(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

/** Check and insert under one organization lock; shares the plan-assignment lock. */
export async function withPlanCapacity<T>(
  db: Db,
  organizationId: string,
  resource: PlanResource,
  insert: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for("update");
    if (!org) throw AppError.notFound("Organization not found");
    const [current] = await tx
      .select({ plan: plans })
      .from(orgPlans)
      .innerJoin(plans, eq(plans.id, orgPlans.planId))
      .where(
        and(
          eq(orgPlans.organizationId, organizationId),
          inArray(orgPlans.status, ["active", "trialing"]),
        ),
      )
      .orderBy(desc(orgPlans.createdAt))
      .limit(1);
    if (current) {
      const window = monthWindow();
      const counts =
        resource === "companies"
          ? await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(companies)
              .where(eq(companies.organizationId, organizationId))
          : resource === "users"
            ? await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(users)
                .where(eq(users.organizationId, organizationId))
            : resource === "api_keys"
              ? await tx
                  .select({ count: sql<number>`count(*)::int` })
                  .from(apiKeys)
                  .where(
                    and(eq(apiKeys.organizationId, organizationId), ne(apiKeys.status, "revoked")),
                  )
              : await tx
                  .select({ count: sql<number>`count(*)::int` })
                  .from(documents)
                  .where(
                    and(
                      eq(documents.organizationId, organizationId),
                      gte(documents.createdAt, window.start),
                      lt(documents.createdAt, window.end),
                    ),
                  );
      const used = Number(counts[0]?.count ?? 0);
      const limit = {
        companies: current.plan.maxCompanies,
        users: current.plan.maxUsers,
        api_keys: current.plan.maxApiKeys,
        documents_this_month: current.plan.maxDocumentsPerMonth,
      }[resource];
      if (used >= limit) {
        throw AppError.forbidden(
          `${resource === "companies" ? "Company" : resource === "users" ? "User" : resource === "api_keys" ? "API key" : "Monthly document"} plan limit reached`,
          {
            details: [{ path: resource, issue: `Plan quota exhausted (${used}/${limit})` }],
          },
        );
      }
    }
    return insert(tx);
  });
}
