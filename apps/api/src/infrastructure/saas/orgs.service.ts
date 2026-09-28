import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import {
  organizations,
  orgPlans,
  plans,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";

export const PLATFORM_ORG_SLUG = "factosys-platform";
export const ORG_STATUSES = ["active", "suspended"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export interface OrgPublic {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  is_platform: boolean;
  current_plan: {
    id: string;
    plan_id: string;
    plan_code: string;
    plan_name: string;
    status: string;
  } | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class OrgsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(filters: {
    status?: OrgStatus;
    q?: string;
    limit?: number;
    includePlatform?: boolean;
  }): Promise<{ items: OrgPublic[] }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const conditions = [];
    if (!filters.includePlatform) {
      conditions.push(
        or(
          sql`${organizations.slug} is null`,
          ne(organizations.slug, PLATFORM_ORG_SLUG),
        )!,
      );
    }
    if (filters.status) {
      conditions.push(eq(organizations.status, filters.status));
    }
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      conditions.push(
        or(ilike(organizations.name, q), ilike(organizations.slug, q))!,
      );
    }

    const rows = await this.db
      .select()
      .from(organizations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(organizations.name))
      .limit(limit);

    const items: OrgPublic[] = [];
    for (const row of rows) {
      items.push(await this.toPublic(row));
    }
    return { items };
  }

  async get(id: string): Promise<OrgPublic> {
    const row = await this.findById(id);
    return this.toPublic(row);
  }

  async patch(
    id: string,
    input: { status: OrgStatus },
  ): Promise<OrgPublic> {
    const row = await this.findById(id);
    if (row.slug === PLATFORM_ORG_SLUG) {
      throw AppError.conflict("Cannot change status of platform organization");
    }
    if (row.status === input.status) {
      return this.toPublic(row);
    }
    await this.db
      .update(organizations)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(organizations.id, id));
    return this.get(id);
  }

  private async findById(
    id: string,
  ): Promise<typeof organizations.$inferSelect> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("Organization not found");
    }
    return row;
  }

  private async currentPlan(organizationId: string): Promise<{
    id: string;
    plan_id: string;
    plan_code: string;
    plan_name: string;
    status: string;
  } | null> {
    const rows = await this.db
      .select({
        orgPlan: orgPlans,
        planCode: plans.code,
        planName: plans.name,
      })
      .from(orgPlans)
      .innerJoin(plans, eq(plans.id, orgPlans.planId))
      .where(
        and(
          eq(orgPlans.organizationId, organizationId),
          ne(orgPlans.status, "canceled"),
        ),
      )
      .orderBy(desc(orgPlans.createdAt))
      .limit(1);
    const hit = rows[0];
    if (!hit) return null;
    return {
      id: hit.orgPlan.id,
      plan_id: hit.orgPlan.planId,
      plan_code: hit.planCode,
      plan_name: hit.planName,
      status: hit.orgPlan.status,
    };
  }

  private async toPublic(
    row: typeof organizations.$inferSelect,
  ): Promise<OrgPublic> {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      is_platform: row.slug === PLATFORM_ORG_SLUG,
      current_plan: await this.currentPlan(row.id),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
