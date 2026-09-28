import { Inject, Injectable } from "@nestjs/common";
import { eq, ne, or, sql } from "drizzle-orm";
import {
  organizations,
  plans,
  signupRequests,
  type Db,
} from "@factosys/db";

import { DB } from "../persistence/db.tokens";
import { PLATFORM_ORG_SLUG } from "./orgs.service";

export interface PlatformStats {
  signup_requests: {
    received: number;
    under_review: number;
    approved: number;
    rejected: number;
    total: number;
  };
  organizations: {
    active: number;
    suspended: number;
    total: number;
  };
  plans: {
    active: number;
    retired: number;
    total: number;
  };
}

@Injectable()
export class PlatformStatsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getStats(): Promise<PlatformStats> {
    const signupRows = await this.db
      .select({
        status: signupRequests.status,
        count: sql<number>`count(*)::int`,
      })
      .from(signupRequests)
      .groupBy(signupRequests.status);

    const signup = {
      received: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };
    for (const row of signupRows) {
      const n = Number(row.count) || 0;
      signup.total += n;
      if (row.status === "received") signup.received = n;
      else if (row.status === "under_review") signup.under_review = n;
      else if (row.status === "approved") signup.approved = n;
      else if (row.status === "rejected") signup.rejected = n;
    }

    const orgRows = await this.db
      .select({
        status: organizations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(organizations)
      .where(
        or(
          sql`${organizations.slug} is null`,
          ne(organizations.slug, PLATFORM_ORG_SLUG),
        )!,
      )
      .groupBy(organizations.status);

    const orgs = { active: 0, suspended: 0, total: 0 };
    for (const row of orgRows) {
      const n = Number(row.count) || 0;
      orgs.total += n;
      if (row.status === "active") orgs.active = n;
      else if (row.status === "suspended") orgs.suspended = n;
    }

    const planActive = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(plans)
      .where(eq(plans.isActive, true));
    const planRetired = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(plans)
      .where(eq(plans.isActive, false));

    const active = Number(planActive[0]?.count) || 0;
    const retired = Number(planRetired[0]?.count) || 0;

    return {
      signup_requests: signup,
      organizations: orgs,
      plans: { active, retired, total: active + retired },
    };
  }
}
